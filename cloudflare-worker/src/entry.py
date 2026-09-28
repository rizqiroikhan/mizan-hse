"""Mizan HSE core Worker persistence adapter backed by Cloudflare D1.

Internal role IDs intentionally retain the local MVP compatibility mapping:
manager = HSE Supervisor (corrective action), supervisor = HSE Manager (verification).
"""

import base64
import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from js import Object, Uint8Array, crypto as js_crypto, fetch as js_fetch
from pyodide.ffi import to_js

from workers import Response, WorkerEntrypoint

ROLE_LABELS = {"staff": "HSE Staff", "manager": "HSE Supervisor", "supervisor": "HSE Manager", "management": "Management"}
CORRECTIVE_ACTION_ROLE = "manager"
VERIFICATION_ROLE = "supervisor"
LEGACY_CREDENTIAL_VERSION = "pbkdf2_sha256_v1_120k"
WEBCRYPTO_CREDENTIAL_VERSION = "pbkdf2_sha256_cf_v2_100k"
WEBCRYPTO_ITERATIONS = 100000
SESSION_SECONDS = 8 * 60 * 60
INACTIVITY_SECONDS = 30 * 60
LOGIN_LOCK_SECONDS = 15 * 60
MAX_FAILED_LOGINS = 5

TEMPLATES = {
    "APAR": {"version": 1, "name": "APAR inspection", "description": "Monthly visual inspection · technical servicing is separate", "items": [
        {"id": "presence", "label": "Present at the registered location"}, {"id": "access", "label": "Accessible and unobstructed"}, {"id": "sign", "label": "Equipment ID and location sign visible"}, {"id": "label", "label": "Operating instructions readable and facing outward"}, {"id": "cylinder", "label": "Cylinder free from visible damage, corrosion and leakage"}, {"id": "handle", "label": "Handle and lever visibly undamaged"}, {"id": "seal", "label": "Safety pin and tamper seal intact"}, {"id": "hose", "label": "Hose / nozzle / horn intact and unobstructed"}, {"id": "gauge", "label": "Pressure within manufacturer operating range", "conditional": "gauge"}, {"id": "mount", "label": "Bracket or cabinet secure and accessible"}, {"id": "service", "label": "Required service and testing up to date"}, {"id": "weight", "label": "CO₂ weight meets equipment-specific criteria", "conditional": "co2"},
    ]},
    "Hydrant": {"version": 1, "name": "Hydrant inspection", "description": "Monthly condition check · 6 components", "items": [{"id": x, "label": label} for x, label in [("box", "Box hydrant"), ("hose", "Fire hose"), ("coupling", "Hose coupling"), ("rack", "Hose rack"), ("nozzle", "Nozzle"), ("valve", "Valve / pillar hydrant")]]},
    "P3K": {"version": 1, "name": "P3K inventory check", "description": "Monthly inventory", "items": [{"id": f"p3k_{i}", "label": f"P3K supply {i}", "required": 1} for i in range(1, 22)]},
    "Patrol": {"version": 1, "name": "Safety patrol", "description": "Safety patrol checklist", "items": [{"id": x, "label": label} for x, label in [("access", "Emergency equipment accessible"), ("exits", "Escape routes and exits clear"), ("housekeeping", "Housekeeping / 5R satisfactory"), ("electrical", "No visible unsafe cables or electrical conditions"), ("waste", "Waste stored in the designated area"), ("signage", "Safety signs visible and legible")]]},
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def pbkdf2_hex(password, salt, iterations=120000):
    """Small dependency-free PBKDF2 fallback; hashlib.pbkdf2_hmac is absent in Pyodide."""
    password_bytes, salt_bytes = password.encode(), salt.encode()
    block = salt_bytes + (1).to_bytes(4, "big")
    previous = hmac.new(password_bytes, block, hashlib.sha256).digest()
    result = bytearray(previous)
    for _ in range(iterations - 1):
        previous = hmac.new(password_bytes, previous, hashlib.sha256).digest()
        for index, value in enumerate(previous):
            result[index] ^= value
    return bytes(result).hex()


async def pbkdf2_webcrypto_hex(password, salt, iterations=WEBCRYPTO_ITERATIONS):
    """Derive the versioned staging profile with Worker-native Web Crypto."""
    password_bytes = Uint8Array.new(to_js(list(password.encode())))
    salt_bytes = Uint8Array.new(to_js(list(salt.encode())))
    key = await js_crypto.subtle.importKey(
        "raw",
        password_bytes,
        to_js({"name": "PBKDF2"}, dict_converter=Object.fromEntries),
        False,
        to_js(["deriveBits"]),
    )
    derived = await js_crypto.subtle.deriveBits(
        to_js({"name": "PBKDF2", "salt": salt_bytes, "iterations": iterations, "hash": "SHA-256"}, dict_converter=Object.fromEntries),
        key,
        256,
    )
    return bytes(Uint8Array.new(derived).to_py()).hex()


def as_py(value):
    return value.to_py() if hasattr(value, "to_py") else value


def json_value(value, fallback):
    try:
        return json.loads(value) if value else fallback
    except (TypeError, ValueError):
        return fallback


def evidence_metadata(values):
    """Retain compatibility metadata for older records without binary payloads."""
    if not isinstance(values, list):
        return []
    keys = ("id", "name", "type", "size", "storageKey")
    return [{key: item.get(key) for key in keys if item.get(key) is not None} for item in values if isinstance(item, dict)]


def safe_key_component(value):
    return "".join(character if character.isalnum() or character in "-_" else "-" for character in str(value))[:120] or "evidence"


class Problem(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status


class R2Storage:
    def __init__(self, bucket):
        self.bucket = bucket

    async def put(self, key, payload, mime, metadata):
        await self.bucket.put(key, payload, httpMetadata={"contentType": mime}, customMetadata=metadata)

    async def delete(self, key):
        await self.bucket.delete(key)

    async def get(self, key):
        obj = await self.bucket.get(key)
        return None if obj is None else (obj.body, 200)


class SupabaseStorage:
    def __init__(self, env):
        self.base_url = str(getattr(env, "SUPABASE_URL", "")).rstrip("/")
        self.service_key = str(getattr(env, "SUPABASE_SERVICE_KEY", ""))
        self.bucket = str(getattr(env, "SUPABASE_BUCKET", "mizan-hse-evidence-staging"))
        if not self.base_url or not self.service_key:
            raise Problem("Supabase Storage is not configured for this Worker.", 503)

    def url(self, key):
        return f"{self.base_url}/storage/v1/object/{self.bucket}/{key}"

    def options(self, method, mime=None, body=None):
        headers = {"Authorization": f"Bearer {self.service_key}", "apikey": self.service_key}
        if mime:
            headers["Content-Type"] = mime
        values = {"method": method, "headers": headers}
        if body is not None:
            values["body"] = Uint8Array.new(to_js(list(body)))
        return to_js(values, dict_converter=Object.fromEntries)

    async def put(self, key, payload, mime, metadata):
        response = await js_fetch(self.url(key), self.options("POST", mime, payload))
        if not response.ok:
            raise Problem("Supabase Storage upload failed.", 502)

    async def delete(self, key):
        response = await js_fetch(self.url(key), self.options("DELETE"))
        if not response.ok and response.status != 404:
            raise Problem("Supabase Storage cleanup failed.", 502)

    async def get(self, key):
        response = await js_fetch(self.url(key), self.options("GET"))
        if response.status == 404:
            return None
        if not response.ok:
            raise Problem("Supabase Storage retrieval failed.", 502)
        return response.body, response.status


class Store:
    def __init__(self, db, storage, allow_demo=False):
        self.db = db
        self.storage = storage
        self.allow_demo = allow_demo
        self.uploaded_keys = []

    async def one(self, sql, *args):
        return as_py(await self.db.prepare(sql).bind(*args).first())

    async def all(self, sql, *args):
        result = as_py(await self.db.prepare(sql).bind(*args).run())
        return result.get("results", []) if isinstance(result, dict) else []

    async def batch(self, statements):
        return as_py(await self.db.batch(statements))

    async def user(self, token):
        row = await self.one("SELECT u.id,u.name,u.role,s.token,s.last_seen_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND s.revoked_at='' AND u.active=1", token, now()) if token else None
        if not row:
            raise Problem("Please sign in online to continue synchronizing.", 401)
        current = datetime.now(timezone.utc)
        try:
            last_seen = datetime.fromisoformat(row["last_seen_at"].replace("Z", "+00:00"))
        except (TypeError, ValueError, AttributeError):
            last_seen = current
        if (current - last_seen).total_seconds() > INACTIVITY_SECONDS:
            await self.db.prepare("UPDATE sessions SET revoked_at=? WHERE token=?").bind(now(), token).run()
            raise Problem("Your session has expired. Please sign in again.", 401)
        await self.db.prepare("UPDATE sessions SET last_seen_at=? WHERE token=?").bind(now(), token).run()
        return {"id": row["id"], "name": row["name"], "role": row["role"]}

    async def login(self, user_id, password):
        row = await self.one("SELECT * FROM users WHERE id=?", user_id)
        if not row or not row["active"] or (row.get("is_demo") and not self.allow_demo):
            raise Problem("Incorrect account or password.", 401)
        if row["locked_until"] and row["locked_until"] > now():
            raise Problem("Incorrect account or password.", 401)
        credential_version = row.get("credential_version") or LEGACY_CREDENTIAL_VERSION
        iterations = int(row.get("password_iterations") or 120000)
        if credential_version == WEBCRYPTO_CREDENTIAL_VERSION:
            digest = await pbkdf2_webcrypto_hex(password, row["salt"], iterations)
        else:
            digest = pbkdf2_hex(password, row["salt"], iterations)
        if not secrets.compare_digest(digest, row["password_hash"]):
            attempts = int(row["failed_login_count"] or 0) + 1
            locked = (datetime.now(timezone.utc) + timedelta(seconds=LOGIN_LOCK_SECONDS)).isoformat() if attempts >= MAX_FAILED_LOGINS else ""
            await self.db.prepare("UPDATE users SET failed_login_count=?,locked_until=? WHERE id=?").bind(attempts if not locked else 0, locked, user_id).run()
            raise Problem("Incorrect account or password.", 401)
        token, csrf_token, timestamp = secrets.token_urlsafe(48), secrets.token_urlsafe(32), now()
        expires = (datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)).isoformat()
        await self.db.prepare("UPDATE users SET failed_login_count=0,locked_until='' WHERE id=?").bind(user_id).run()
        await self.db.prepare("INSERT INTO sessions(token,user_id,expires_at,created_at,last_seen_at,csrf_token) VALUES(?,?,?,?,?,?)").bind(token, user_id, expires, timestamp, timestamp, csrf_token).run()
        return token, csrf_token, {"id": row["id"], "name": row["name"], "role": row["role"]}

    async def state(self):
        sites = await self.all("SELECT id,name,city,code FROM sites ORDER BY id")
        users = await self.all("SELECT id,name FROM users")
        user_names = {row["id"]: row["name"] for row in users}
        assets_rows = await self.all("SELECT * FROM assets ORDER BY id")
        inspections_rows = await self.all("SELECT * FROM inspections ORDER BY created_at DESC")
        findings_rows = await self.all("SELECT * FROM findings ORDER BY created_at DESC")
        flags_rows = await self.all("SELECT * FROM flags ORDER BY created_at DESC")
        activity = await self.all("SELECT id,text,actor,at,entity_type AS entityType,entity_id AS entityId,action FROM activity ORDER BY at DESC LIMIT 100")
        answers = await self.all("SELECT * FROM inspection_answers ORDER BY inspection_id,question_id")
        histories = await self.all("SELECT * FROM finding_history ORDER BY id")
        evidence_rows = await self.all("SELECT * FROM evidence WHERE status='stored' ORDER BY uploaded_at")
        answer_map, history_map = {}, {}
        evidence_map = {}
        for row in answers:
            answer_map.setdefault(row["inspection_id"], []).append({"id": row["question_id"], "status": row["status"], "note": row["note"], "quantity": row["quantity"], "expiry": row["expiry"]})
        for row in histories:
            history_map.setdefault(row["finding_id"], []).append({"action": row["action"], "note": row["note"], "actor": row["actor"], "at": row["at"], "previousStatus": row["previous_status"], "resultingStatus": row["resulting_status"]})
        for row in evidence_rows:
            metadata = {"id": row["id"], "name": row["original_name"], "type": row["mime_type"], "size": row["byte_size"], "purpose": row["purpose"], "evidenceId": row["id"]}
            evidence_map.setdefault((row["owner_type"], row["owner_id"]), []).append(metadata)
        inspections = [{"id": r["id"], "siteId": r["site_id"], "assetId": r["asset_id"], "type": r["type"], "zone": r["zone"], "period": r["period"], "date": r["inspection_date"], "status": r["status"], "inspector": r["inspector"], "createdBy": r["created_by"], "createdAt": r["created_at"], "updatedAt": r["updated_at"], "revision": r["revision"], "templateVersion": r["template_version"], "notes": r["notes"], "reviewNote": r["review_note"], "reviewer": r["reviewer"], "reviewedAt": r["reviewed_at"], "missing": bool(r["missing"]), "observations": json_value(r["observations_json"], []), "photos": evidence_map.get(("inspection", r["id"]), json_value(r["evidence_json"], [])), "answers": answer_map.get(r["id"], []), "weight": r["weight"], "referenceWeight": r["reference_weight"], "minimumWeight": r["minimum_weight"]} for r in inspections_rows]
        findings = [{"id": r["id"], "inspectionId": r["inspection_id"], "assetId": r["asset_id"], "siteId": r["site_id"], "title": r["title"], "detail": r["detail"], "severity": r["severity"], "status": r["status"], "dueDate": r["due_date"], "owner": r["owner"], "completion": r["completion"], "evidence": evidence_map.get(("finding", r["id"]), json_value(r["evidence_json"], [])), "photos": evidence_map.get(("inspection", r["inspection_id"]), []), "completedBy": r["completed_by"], "verifiedBy": user_names.get(r["verified_by"], r["verified_by"]), "verifiedAt": r["verified_at"], "revision": r["revision"], "createdAt": r["created_at"], "history": history_map.get(r["id"], []), "sample": bool(r["sample"])} for r in findings_rows]
        assets = [{"id": r["id"], "siteId": r["site_id"], "type": r["type"], "zone": r["zone"], "name": r["name"], "subtype": r["subtype"], "capacity": r["capacity"], "serial": r["serial"], "serviceDue": r["service_due"], "expiryDate": r["expiry_date"], "dueDate": r["due_date"], "revision": r["revision"]} for r in assets_rows]
        flags = [{"id": r["id"], "inspectionId": r["inspection_id"], "siteId": r["site_id"], "reason": r["reason"], "status": r["status"], "resolution": r["resolution"], "reviewer": r["reviewer"], "resolvedAt": r["resolved_at"], "revision": r["revision"], "createdAt": r["created_at"]} for r in flags_rows]
        return {"sites": sites, "assets": assets, "inspections": inspections, "findings": findings, "flags": flags, "activity": activity, "templates": TEMPLATES, "serverTime": now()}

    async def apply(self, user, operation):
        if not isinstance(operation, dict) or not isinstance(operation.get("id"), str) or not 8 <= len(operation["id"]) <= 100:
            raise Problem("A unique operation ID is required.")
        prior = await self.one("SELECT user_id,result_json FROM operations WHERE id=?", operation["id"])
        if prior:
            if prior["user_id"] != user["id"]:
                raise Problem("Operation belongs to another account.", 403)
            return json.loads(prior["result_json"])
        kind, data = operation.get("kind"), operation.get("data", {})
        self.uploaded_keys = []
        try:
            if kind == "create_inspection":
                result, statements = await self.create_inspection(user, data)
            elif kind == "finding_action":
                result, statements = await self.finding_action(user, operation, data)
            elif kind == "review_inspection":
                result, statements = await self.review_inspection(user, operation, data)
            elif kind == "resolve_flag":
                result, statements = await self.resolve_flag(user, operation, data)
            elif kind == "create_asset":
                result, statements = await self.create_asset(user, data)
            else:
                raise Problem("Unknown operation.")
            timestamp = now()
            statements.extend([
                self.db.prepare("INSERT INTO operations(id,user_id,result_json,created_at) VALUES(?,?,?,?)").bind(operation["id"], user["id"], json.dumps(result), timestamp),
                self.db.prepare("INSERT INTO activity(id,text,actor,at,entity_type,entity_id,action) VALUES(?,?,?,?,?,?,?)").bind(str(uuid.uuid4()), result["message"], user["name"], timestamp, kind, result.get("id"), kind),
            ])
            await self.batch(statements)
            return result
        except Exception:
            for key in self.uploaded_keys:
                try:
                    await self.storage.delete(key)
                except Exception as cleanup_error:
                    print(f"Evidence cleanup failed for key {key}: {cleanup_error!r}", flush=True)
            raise

    async def store_evidence(self, values, owner_type, owner_id, user):
        if not values:
            return [], []
        if len(values) > 8:
            raise Problem("Attach up to 8 photos.")
        if owner_type == "inspection":
            owner = await self.one("SELECT id,created_by FROM inspections WHERE id=?", owner_id)
            if owner and user["role"] == "staff" and owner["created_by"] != user["id"]:
                raise Problem("You are not allowed to attach evidence to this inspection.", 403)
            if not owner and user["role"] not in ("staff", CORRECTIVE_ACTION_ROLE, VERIFICATION_ROLE):
                raise Problem("You are not allowed to attach evidence to this inspection.", 403)
        else:
            owner = await self.one("SELECT id FROM findings WHERE id=?", owner_id)
            if not owner or user["role"] != CORRECTIVE_ACTION_ROLE:
                raise Problem("Only the HSE Supervisor can attach corrective-action evidence.", 403)
        metadata, statements = [], []
        for value in values:
            if not isinstance(value, dict) or not isinstance(value.get("data"), str):
                raise Problem("Evidence payload is invalid.")
            header, separator, encoded = value["data"].partition(",")
            mime = header[5:].split(";", 1)[0] if header.startswith("data:") and separator else ""
            if mime not in ("image/jpeg", "image/png", "image/webp") or "base64" not in header:
                raise Problem("Use JPEG, PNG or WebP evidence.")
            try:
                payload = base64.b64decode(encoded, validate=True)
            except Exception:
                raise Problem("Evidence payload is malformed.")
            if not payload or len(payload) > 1_500_000:
                raise Problem("Evidence must be non-empty and under 1.5 MB.")
            evidence_id = str(value.get("id") or uuid.uuid4())
            extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[mime]
            key = f"{owner_type}s/{safe_key_component(owner_id)}/{safe_key_component(evidence_id)}.{extension}"
            existing = await self.one("SELECT id FROM evidence WHERE id=?", evidence_id)
            if existing:
                metadata.append({"id": evidence_id, "name": value.get("name", "evidence"), "type": mime, "size": len(payload), "purpose": "completion" if owner_type == "finding" else "inspection", "evidenceId": evidence_id})
                continue
            await self.storage.put(key, payload, mime, {"uploadedBy": user["id"], "ownerType": owner_type, "ownerId": owner_id})
            self.uploaded_keys.append(key)
            purpose = "completion" if owner_type == "finding" else "inspection"
            metadata.append({"id": evidence_id, "name": value.get("name", "evidence"), "type": mime, "size": len(payload), "purpose": purpose, "evidenceId": evidence_id})
            statements.append(self.db.prepare("INSERT INTO evidence(id,owner_type,owner_id,inspection_id,finding_id,object_key,original_name,mime_type,byte_size,purpose,uploaded_by,uploaded_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(evidence_id, owner_type, owner_id, owner_id if owner_type == "inspection" else None, owner_id if owner_type == "finding" else None, key, value.get("name", "evidence"), mime, len(payload), purpose, user["id"], now(), "stored"))
        return metadata, statements

    async def create_inspection(self, user, data):
        if user["role"] not in ("staff", CORRECTIVE_ACTION_ROLE, VERIFICATION_ROLE):
            raise Problem("Your role cannot perform this action.", 403)
        if any(not data.get(k) for k in ("id", "siteId", "type", "period", "date", "answers")) or data["type"] not in TEMPLATES:
            raise Problem("A valid inspection checklist is required.")
        if await self.one("SELECT id FROM inspections WHERE id=?", data["id"]):
            raise Problem("Inspection already exists.", 409)
        flag_reasons = []
        asset = await self.one("SELECT id,site_id,type FROM assets WHERE id=?", data.get("assetId")) if data["type"] != "Patrol" else None
        if data["type"] != "Patrol" and (not asset or asset["type"] != data["type"]):
            raise Problem("Select equipment matching the checklist type.")
        expected_questions = {item["id"] for item in TEMPLATES[data["type"]]["items"]}
        answers = data.get("answers", [])
        if len(answers) != len(expected_questions) or {answer.get("id") for answer in answers} != expected_questions:
            raise Problem("Complete every checklist item before submitting.")
        if any(answer.get("status") not in ("pass", "fail", "na", "missing", "expired") for answer in answers):
            raise Problem("Checklist answers contain an invalid status.")
        if asset and asset["site_id"] != data["siteId"]:
            flag_reasons.append("Equipment site differs from inspection site")
        if data["date"][:7] != data["period"]:
            flag_reasons.append("Inspection date differs from the scheduled period")
        if data["date"] > datetime.now(timezone.utc).date().isoformat():
            flag_reasons.append("Inspection date is in the future; check device date")
        if asset and await self.one("SELECT id FROM inspections WHERE asset_id=? AND period=? AND type=?", data.get("assetId"), data["period"], data["type"]):
            flag_reasons.append("Potential duplicate inspection for this equipment and period")
        timestamp = now()
        evidence, evidence_statements = await self.store_evidence(data.get("photos", []), "inspection", data["id"], user)
        values = [data["id"], data["siteId"], data.get("assetId"), data["type"], data.get("zone", ""), data["period"], data["date"], "submitted", user["name"], user["id"], timestamp, timestamp, 1, TEMPLATES[data["type"]]["version"], data.get("notes", ""), int(bool(data.get("missing"))), json.dumps(data.get("observations", [])), json.dumps(evidence), data.get("weight"), data.get("referenceWeight"), data.get("minimumWeight")]
        statements = [self.db.prepare("INSERT INTO inspections(id,site_id,asset_id,type,zone,period,inspection_date,status,inspector,created_by,created_at,updated_at,revision,template_version,notes,missing,observations_json,evidence_json,weight,reference_weight,minimum_weight) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(*values)]
        statements.extend(evidence_statements)
        for answer in answers:
            statements.append(self.db.prepare("INSERT INTO inspection_answers(inspection_id,question_id,status,note,quantity,expiry) VALUES(?,?,?,?,?,?)").bind(data["id"], answer.get("id"), answer.get("status"), answer.get("note", ""), answer.get("quantity"), answer.get("expiry", "")))
        for reason in flag_reasons:
            statements.append(self.db.prepare("INSERT INTO flags(id,inspection_id,site_id,reason,status,revision,created_at) VALUES(?,?,?,?,?,?,?)").bind(str(uuid.uuid4()), data["id"], data["siteId"], reason, "open", 1, timestamp))
        failed = [answer for answer in answers if answer.get("status") in ("fail", "missing", "expired")]
        for answer in failed:
            title = next((q["label"] for q in TEMPLATES[data["type"]]["items"] if q["id"] == answer.get("id")), answer.get("id", "Finding"))
            statements.append(self.db.prepare("INSERT INTO findings(id,inspection_id,asset_id,site_id,title,detail,severity,status,due_date,owner,completion,evidence_json,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(str(uuid.uuid4()), data["id"], data.get("assetId"), data["siteId"], title, answer.get("note", ""), "medium", "open", (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat(), ROLE_LABELS[CORRECTIVE_ACTION_ROLE], "", json.dumps(evidence), 1, timestamp))
        return {"message": f"{data['type']} inspection submitted · {len(failed)} findings", "id": data["id"], "flags": len(flag_reasons)}, statements

    async def finding_action(self, user, operation, data):
        finding = await self.one("SELECT * FROM findings WHERE id=?", data.get("id"))
        if not finding or operation.get("expectedRevision") != finding["revision"]:
            raise Problem("This record changed since your last sync. Your changes are preserved locally. Refresh and review before retrying.", 409)
        action, previous = data.get("action"), finding["status"]
        if action in ("start", "complete"):
            if user["role"] != CORRECTIVE_ACTION_ROLE:
                raise Problem("Your role cannot perform this action.", 403)
            if previous not in ("open", "in_progress"):
                raise Problem("This finding is not available for corrective work.")
            if action == "complete":
                result_status = "awaiting_verification"
                evidence, evidence_statements = await self.store_evidence(data.get("evidence", []), "finding", finding["id"], user)
            else:
                result_status, evidence, evidence_statements = "in_progress", json_value(finding["evidence_json"], []), []
            if action == "complete" and (not data.get("note", "").strip() or not evidence):
                raise Problem("Completion notes and evidence metadata are required.")
            statements = [self.db.prepare("UPDATE findings SET status=?,completion=?,evidence_json=?,completed_by=?,revision=revision+1 WHERE id=? AND revision=?").bind(result_status, data.get("note", "") if action == "complete" else finding["completion"], json.dumps(evidence), user["id"] if action == "complete" else finding["completed_by"], finding["id"], finding["revision"])]
            statements.extend(evidence_statements)
        elif action in ("verify", "reject"):
            if user["role"] != VERIFICATION_ROLE:
                raise Problem("Your role cannot perform this action.", 403)
            if previous != "awaiting_verification":
                raise Problem("The finding must await verification first.")
            if not data.get("note", "").strip():
                raise Problem("A verification or rejection note is required.")
            result_status = "closed" if action == "verify" else "in_progress"
            statements = [self.db.prepare("UPDATE findings SET status=?,verified_by=?,verified_at=?,revision=revision+1 WHERE id=? AND revision=?").bind(result_status, user["id"] if action == "verify" else None, now() if action == "verify" else None, finding["id"], finding["revision"])]
        else:
            raise Problem("Unknown finding action.")
        statements.append(self.db.prepare("INSERT INTO finding_history(finding_id,action,note,actor,at,previous_status,resulting_status) VALUES(?,?,?,?,?,?,?)").bind(finding["id"], action, data.get("note", ""), user["name"], now(), previous, result_status))
        return {"message": f"Corrective action: {finding['title']} · {result_status.replace('_', ' ')}", "id": finding["id"], "status": result_status}, statements

    async def review_inspection(self, user, operation, data):
        if user["role"] not in (CORRECTIVE_ACTION_ROLE, VERIFICATION_ROLE):
            raise Problem("Your role cannot perform this action.", 403)
        row = await self.one("SELECT * FROM inspections WHERE id=?", data.get("id"))
        if not row or operation.get("expectedRevision") != row["revision"]:
            raise Problem("This record changed since your last sync.", 409)
        decision = data.get("decision")
        if row["status"] != "submitted" or decision not in ("approved", "returned"):
            raise Problem("Only submitted inspections can be reviewed.")
        if decision == "returned" and not data.get("note", "").strip():
            raise Problem("Provide a reason for returning the inspection.")
        if decision == "approved" and await self.one("SELECT id FROM flags WHERE inspection_id=? AND status='open'", row["id"]):
            raise Problem("Resolve the data review flags before approval.")
        timestamp = now()
        return {"message": f"{row['type']} inspection {decision}", "id": row["id"]}, [self.db.prepare("UPDATE inspections SET status=?,review_note=?,reviewer=?,reviewed_at=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?").bind(decision, data.get("note", ""), user["name"], timestamp, timestamp, row["id"], row["revision"])]

    async def resolve_flag(self, user, operation, data):
        if user["role"] not in (CORRECTIVE_ACTION_ROLE, VERIFICATION_ROLE):
            raise Problem("Your role cannot perform this action.", 403)
        row = await self.one("SELECT * FROM flags WHERE id=?", data.get("id"))
        if not row or operation.get("expectedRevision") != row["revision"]:
            raise Problem("This record changed since your last sync.", 409)
        if not data.get("note", "").strip() or row["status"] != "open":
            raise Problem("Document the reason for resolving this flag.")
        return {"message": "Data review flag resolved with a recorded explanation", "id": row["id"]}, [self.db.prepare("UPDATE flags SET status='resolved',resolution=?,reviewer=?,resolved_at=?,revision=revision+1 WHERE id=? AND revision=?").bind(data["note"], user["name"], now(), row["id"], row["revision"])]

    async def create_asset(self, user, data):
        if user["role"] not in (CORRECTIVE_ACTION_ROLE, VERIFICATION_ROLE):
            raise Problem("Your role cannot perform this action.", 403)
        if await self.one("SELECT id FROM assets WHERE id=?", data.get("id")):
            raise Problem("Equipment ID already exists.", 409)
        if data.get("type") not in ("APAR", "Hydrant", "P3K") or not data.get("siteId"):
            raise Problem("Invalid equipment type or site.")
        return {"message": f"Equipment {data['id']} registered", "id": data["id"]}, [self.db.prepare("INSERT INTO assets(id,site_id,type,zone,name,subtype,capacity,serial,service_due,expiry_date,due_date,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)").bind(data["id"], data["siteId"], data["type"], data.get("zone", ""), data.get("name", data["id"]), data.get("subtype", ""), data.get("capacity", ""), data.get("serial", ""), data.get("serviceDue", ""), data.get("expiryDate", ""), data.get("dueDate", ""))]


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        parsed = urlparse(request.url)
        if parsed.path == "/api/health":
            try:
                await self.env.DB.prepare("SELECT 1 AS ok").run()
                return self._json({"status": "ok", "database": "d1"})
            except Exception:
                return self._json({"status": "ok", "database": "unavailable"}, status=503)
        if not parsed.path.startswith("/api/"):
            return Response.json({"error": "Not Found"}, status=404)
        environment = getattr(self.env, "MIZAN_ENV", "production")
        storage_backend = getattr(self.env, "MIZAN_STORAGE_BACKEND", "r2")
        try:
            storage = R2Storage(self.env.EVIDENCE) if storage_backend == "r2" else SupabaseStorage(self.env)
        except Problem as error:
            return self._json({"error": error.message}, status=error.status)
        store = Store(self.env.DB, storage, allow_demo=environment == "development")
        try:
            token = self._cookie(request, "mizan_session")
            if request.method == "GET" and parsed.path == "/api/state":
                await store.user(token)
                return self._json(await store.state())
            if request.method == "GET" and parsed.path == "/api/session":
                return self._json({"user": await store.user(token)})
            if request.method == "GET" and parsed.path.startswith("/api/evidence/"):
                user = await store.user(token)
                evidence_id = parsed.path.rsplit("/", 1)[-1]
                row = await store.one("SELECT * FROM evidence WHERE id=? AND status='stored'", evidence_id)
                if not row:
                    raise Problem("Evidence not found.", 404)
                if user["role"] == "staff":
                    allowed = await store.one("SELECT created_by FROM inspections WHERE id=?", row["inspection_id"] or "")
                    if not allowed or allowed["created_by"] != user["id"]:
                        raise Problem("You are not allowed to view this evidence.", 403)
                result = await store.storage.get(row["object_key"])
                if result is None:
                    raise Problem("Evidence object is unavailable.", 404)
                body, status = result
                return self._response(body, {"content-type": row["mime_type"], "content-length": str(row["byte_size"])}, status=status)
            if request.method == "POST":
                self._check_origin(request, parsed.path)
                body = as_py(await request.json())
                if parsed.path == "/api/login":
                    requested_user = str(body.get("user", ""))
                    # The shared PWA submits canonical role IDs. Staging keeps
                    # disposable pilot account IDs so existing records remain
                    # stable; resolve those aliases only in staging.
                    if environment == "staging":
                        requested_user = {
                            "staff": "pilot_staff",
                            "manager": "pilot_supervisor",
                            "supervisor": "pilot_manager",
                            "management": "pilot_management",
                        }.get(requested_user, requested_user)
                    login_token, csrf_token, user = await store.login(requested_user, str(body.get("password", "")))
                    secure = "; Secure" if environment != "development" else ""
                    return self._json({"user": user}, headers={"set-cookie": f"mizan_session={login_token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_SECONDS}{secure}", "x-mizan-csrf": csrf_token})
                user = await store.user(token)
                if parsed.path in ("/api/logout", "/api/operations") and request.headers.get("x-requested-with") != "mizan-hse":
                    raise Problem("State-changing requests require the Mizan client header.", 403)
                if parsed.path == "/api/logout":
                    await self.env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE token=?").bind(now(), token).run()
                    secure = "; Secure" if environment != "development" else ""
                    return self._json({"ok": True}, headers={"set-cookie": f"mizan_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0{secure}"})
                if parsed.path == "/api/operations":
                    return self._json(await store.apply(user, body))
            raise Problem("Endpoint not found.", 404)
        except Problem as error:
            return self._json({"error": error.message}, status=error.status)
        except Exception as error:
            print(f"Worker error: {error!r}", flush=True)
            return self._json({"error": "The Worker could not save this change."}, status=500)

    @staticmethod
    def _json(payload, status=200, headers=None):
        safe = {"x-content-type-options": "nosniff", "referrer-policy": "same-origin", "x-frame-options": "DENY", "permissions-policy": "camera=(self)"}
        safe.update(headers or {})
        return Response.json(payload, status=status, headers=safe)

    @staticmethod
    def _response(body, headers=None, status=200):
        safe = {"x-content-type-options": "nosniff", "referrer-policy": "same-origin", "x-frame-options": "DENY", "permissions-policy": "camera=(self)"}
        safe.update(headers or {})
        return Response(body, status=status, headers=safe)

    @staticmethod
    def _check_origin(request, path):
        origin = request.headers.get("origin", "")
        if origin and origin != urlparse(request.url).scheme + "://" + urlparse(request.url).netloc:
            raise Problem("Cross-origin state-changing requests are not allowed.", 403)

    @staticmethod
    def _cookie(request, name):
        for part in request.headers.get("cookie", "").split(";"):
            key, _, value = part.strip().partition("=")
            if key == name:
                return value
        return ""
