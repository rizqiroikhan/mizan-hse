# Mizan HSE — TASK.md

Last updated: 2026-09-28

## Purpose

File ini berisi **task development aktif**.

Aturan utama:

- Kerjakan **satu task pada satu waktu**.
- Jangan lanjut ke task berikutnya secara otomatis.
- Baca `CURRENT.md` terlebih dahulu.
- Gunakan `PLAN.md` hanya jika membutuhkan klarifikasi requirement.
- Jangan mengubah arsitektur atau module yang tidak berkaitan.
- Jangan melakukan refactor besar kecuali task memang meminta.
- Setelah selesai, lakukan validation yang relevan lalu **STOP**.

---

# CURRENT TASK

## TASK-003 — Pilot Readiness and Production Gap Assessment

**Priority:** High  
**Status:** Completed — assessment only  
**Date:** 2026-09-28

The current Cloudflare staging implementation was audited against controlled-pilot and production-readiness requirements without changing code, data, credentials, or cloud resources. The only confirmed pilot blocker is the missing physical Android/iPhone offline → reconnect validation. Production remains blocked by backup/restore, monitoring and alerting, user/password lifecycle, privacy/retention, device/browser coverage, scale testing, and production authentication review requirements.

### Next task (not started)

**TASK-003-A — Physical-device PWA offline/reconnect pilot validation**

**Status:** Blocked pending read-only remote record correlation and cleanup of temporary debug snapshots

Run one controlled HTTPS test with one device, one HSE Staff account, one APAR inspection, one failed item, one compressed image, and one reconnect cycle. Confirm draft/evidence retention, queue synchronization, exactly one remote inspection/finding/evidence result, and no loss of pending work. Do not begin automatically.

### Existing operator evidence

- Physical mobile PWA use was observed.
- Pending Changes changed from `1` offline to `0` after reconnect.
- No duplicate was observed by the operator.
- HSE Supervisor access worked.
- Existing evidence/photo opened successfully on mobile.
- Final linear staging account naming was visible.

### Remaining validation blocker

The specific inspection/operation ID from that test is not recorded, and the current execution environment cannot authenticate to the remote D1/Worker for a read-only correlation query. Consequently, exact remote uniqueness, failed-answer/note persistence, finding count, evidence metadata/object association, retrieval, and idempotency state for that test cannot yet be established. No new data or cloud mutation was performed.

### Final correlation attempt — 2026-09-28

The supplied correlation note `PILOT-FINAL-20260928` was not found in the local repository. Remote lookup could not be performed because Wrangler has no authenticated session, the deployed Worker requires an authenticated user for state access, and no operator staging session or credential handoff is available. Cloudflare dashboard access likewise requires interactive authentication. No credentials were requested or changed, and no cloud mutation occurred.

### Closeout checkpoint

The operator supplied the final correlation query, but its result set has not been returned. JavaScript syntax and root/Cloudflare frontend-copy hashes pass. Python compilation could not run because no Python interpreter is installed in the current Windows environment. Temporary `tmp/served-app-v2.js` and `tmp/served-app-v3.js` files contain the old development demo password and must be removed or excluded before commit. Commit readiness is blocked; no source or cloud changes were made.

## TASK-002E-A — Resolve remote authentication CPU compatibility

**Priority:** High  
**Status:** Completed  
**Parent:** TASK-002E — Remote Cloudflare Staging Deployment

The staging-only versioned profile `pbkdf2_sha256_cf_v2_100k` now uses native Web Crypto. Legacy `pbkdf2_sha256_v1_120k` credentials remain identifiable and continue through the existing compatibility path. Disposable staging users were reprovisioned with unique credentials; production authentication requires a separate security review.

## TASK-002C-R — Replace R2 Adapter with Supabase Storage

**Priority:** High  
**Status:** Completed  
**Type:** Storage Adapter / Migration  

### Current checkpoint

The Worker now has a centralized Supabase Storage adapter for staging/production while preserving D1 evidence metadata, the authenticated evidence route, and the validated local R2 fallback for development. The local MVP remains separate and unchanged.

### Validation completed

- Supabase adapter code and explicit storage backend configuration are in place.
- Development Worker still starts with the validated local R2 adapter.
- Staging Worker selects Supabase with server-only credentials configured in Wrangler secrets.
- D1 evidence metadata and authorization code remain unchanged.
- A new staging Worker deployment was published in the Adminssnai account with remote D1 and an `hse.ssnai.org/*` route.
- Real Supabase upload, authenticated retrieval, D1 metadata, duplicate retry, invalid-file rejection, role authorization, rejection/resubmission, historical integrity, and redeploy persistence checks passed.
- Migration `0005_credential_versions.sql` adds explicit credential version and iteration metadata. Remote staging login now uses the 100k Web Crypto profile; local legacy credentials remain on 120k PBKDF2.
- Root `server.py`, SQLite persistence, offline queue, and local MVP remain intact.

## NEXT TASK

### TASK-002E — Remote Cloudflare Staging Deployment

**Status:** In Progress — remote deployment and desktop HTTPS validation complete; real-device offline validation remains.

### TASK-002E validation checkpoint — 2026-09-28

- Staging Worker redeployed as version `8f3f5f3e-f0c1-4ffa-ac7c-eb0bee22e409` at `https://hse.ssnai.org`.
- Remote D1 migration ledger is current through migrations `0001`–`0005`; staging uses Supabase Storage and has no R2 binding.
- `/api/health`, HTML, CSS, JavaScript, manifest, service worker, and icons returned HTTP 200. The browser login shell rendered without blocking parser/console errors.
- Remote D1 records and evidence metadata remain present after redeployment. Unauthenticated evidence access returned HTTP 401.
- Previously validated remote logins, lockout/disabled-user/logout behavior, Supabase evidence upload/retrieval, corrective-action rejection/resubmission/closure, role-boundary 403 checks, idempotency, and historical `Fail` integrity remain the accepted cloud baseline.
- **Remaining blocker:** a real Android or iPhone test of PWA use and offline → reconnect → synchronization is required before this task can be marked Completed. No physical mobile device is available in the current execution environment.
- Four existing staging users were reset with unique `pbkdf2_sha256_cf_v2_100k` credentials. Their IDs, roles, permissions, and sessions model were preserved; plaintext passwords are not in repository files, documentation, or logs.
- A staging-only login alias maps the PWA's canonical role values to the preserved `pilot_*` account IDs. All four remote UI logins succeeded, an invalid password returned HTTP 401, and the existing role-boundary checks remain unchanged.
- Login-form compatibility was added for browser password managers: named username/password inputs with `autocomplete` semantics and a real form submit event. The successful API path now leaves the form mounted for 800 ms before replacing it with the dashboard, allowing the browser to observe the completed credential submission. The disabled demo password is no longer embedded in the frontend. Staging serves Worker version `081de02e-44ad-4c49-acba-772ab21b1cd5`.
- Mobile/PWA maintenance deployed as Worker version `391d0e31-e912-4e47-bf0c-32f733baa6b6`: service-worker shell cache bumped to `mizan-shell-v4` to invalidate stale installed assets, and metadata-backed evidence now loads lazily through authenticated `/api/evidence/{id}` as a Blob with object-URL cleanup. No new inspection or evidence upload was performed; authorized physical-device image validation remains pending because no staging credential/session is available in this execution environment.
- Frontend workspace-account mapping maintenance deployed after a read-only state/cache diagnosis. No persisted role/account mapping was found in the client data model; the fix makes staging default to `pilot_manager` for the HSE Supervisor role, translates autofilled staging usernames back to the correct role chip, and bumps the shell cache to v5 so installed clients receive the updated app.js. Offline drafts, pending operations, and evidence state were preserved.
- PWA update-strategy hardening deployed: mutable shell resources use network-first with offline fallback, the icon uses cache-first, obsolete application shell caches are removed without touching IndexedDB, `/sw.js` is excluded from caching, and registration uses `updateViaCache: 'none'`. A one-time update check reloads only when no inspection is active and otherwise offers an update prompt. Live staging now serves shell cache v6 with the corrected role mapping.
- Staging account naming was aligned with business roles without changing the proven backend permission model: `pilot_staff` → HSE Staff, `pilot_supervisor` → HSE Supervisor, `pilot_manager` → HSE Manager, `pilot_management` → Management. Existing D1 IDs and credential fields were preserved; only the two role assignments and display names were corrected. The frontend copies and staging alias mapping were deployed once, with no new records, uploads, or password resets.

Do not start this task automatically. It will perform the remaining HTTPS staging smoke validation and deployment checks; Supabase is the staging evidence backend and remote R2 is not required.

Resume after Supabase evidence storage validation. Remote D1 was created and all four migrations were applied; the former R2 billing blocker is no longer the active storage path.

## Role Terminology Correction — Completed

The internal role IDs remain unchanged to preserve existing sessions and records. Their canonical labels and permission meanings are now:

- `manager` → HSE Supervisor: corrective-action work and completion evidence
- `supervisor` → HSE Manager: corrective-action rejection and verification/closure

Existing state transitions and backend authorization branches were preserved. Existing finding owner metadata was normalized to HSE Supervisor; immutable activity/history actor text was retained.

## TASK-001 — End-to-End Demo Flow Validation

**Priority:** High  
**Status:** Completed  
**Type:** Validation / Bug Fix  
**Recommended model:** GPT-5.6 Luna Light

### Goal

Pastikan workflow demo utama berjalan penuh tanpa error:

`HSE Staff Inspection`

→ `Fail Item`

→ `Finding`

→ `Corrective Action`

→ `HSE Supervisor Completion`

→ `HSE Manager Verification`

→ `Closed`

→ `Dashboard Update`

---

## Scenario

Gunakan satu equipment APAR demo.

Contoh:

`APAR-001`

### Step 1 — HSE Staff

Login sebagai HSE Staff.

Lakukan inspeksi APAR.

Set:

`Pressure Indicator = Fail`

Tambahkan:

- catatan
- photo evidence

Submit inspection.

### Expected

- inspection berhasil tersimpan
- status inspection sesuai workflow
- finding dibuat dari failed item
- evidence tetap terhubung ke inspection

---

### Step 2 — Inspection Review

Review inspection yang baru disubmit.

### Expected

Reviewer dapat:

- melihat inspection
- melihat failed checklist item
- melihat catatan
- melihat photo evidence
- approve inspection

Jika dikembalikan:

- reason harus tersimpan
- inspection dapat diperbaiki

---

### Step 3 — Finding

Buka finding dari inspection tersebut.

### Expected

Finding menampilkan:

- Finding ID
- Inspection ID
- Equipment ID
- Site
- Location
- failed checklist item
- description
- evidence
- created date
- status

Initial status:

`Open`

Finding harus ditugaskan ke:

`HSE Supervisor`

---

### Step 4 — HSE Supervisor

Login sebagai HSE Supervisor.

Buka corrective action.

Ubah:

`Open → In Progress`

Tambahkan:

- corrective-action description
- completion note
- completion evidence

Submit corrective action.

### Expected

Status menjadi:

`Awaiting Verification`

HSE Supervisor tidak boleh memiliki opsi untuk melakukan final verification.

---

### Step 5 — HSE Manager

Login sebagai HSE Manager.

Buka corrective action dengan status:

`Awaiting Verification`

Manager harus dapat melihat:

- original finding
- original inspection evidence
- corrective-action description
- completion evidence

Verify corrective action.

### Expected

Status berubah menjadi:

`Closed`

Activity/history mencatat siapa yang melakukan verification.

---

### Step 6 — Self Verification Protection

Login kembali sebagai HSE Supervisor.

Pastikan Supervisor tidak dapat melakukan:

`Awaiting Verification → Closed`

### Expected

Self-verification ditolak.

Jangan hanya menyembunyikan tombol di UI.

Jika memungkinkan, rule juga harus divalidasi pada logic/backend.

---

### Step 7 — Rejection Flow

Gunakan corrective action lain atau ulangi scenario.

Manager memilih reject.

Tambahkan rejection reason.

### Expected

Status berubah:

`Awaiting Verification → In Progress`

Rejection reason tersimpan.

History mencatat:

- supervisor
- timestamp
- rejection reason

---

### Step 8 — Historical Integrity

Setelah corrective action ditutup:

Buka kembali original inspection.

### Expected

Original failed item harus tetap:

`Fail`

Jangan mengubah historical inspection menjadi `Pass`.

Corrective action hanya mengubah current verified condition.

---

### Step 9 — Dashboard Update

Buka dashboard setelah corrective action selesai.

### Expected

Dashboard harus merefleksikan status terbaru untuk:

- open findings
- corrective-action status
- closed actions

Original inspection compliance tidak boleh dihitung ulang seolah inspection awal selalu Pass.

---

# Validation

Setelah task selesai:

## Python

Pastikan server masih dapat compile/start.

Contoh validation:

```bash
python -m py_compile server.py
```

## JavaScript

Lakukan syntax validation pada:

```text
public/app.js
```

Gunakan command yang sudah tersedia di project/environment.

## Manual Smoke Test

Minimal cek:

- login
- dashboard
- inspections
- APAR form
- findings
- corrective actions
- review queue

---

# Completion Criteria

TASK-001 dianggap selesai hanya jika:

- end-to-end demo flow berjalan
- tidak ada blocking error
- Supervisor tidak dapat self-verify
- Manager dapat verify
- Manager dapat reject
- rejection reason tersimpan
- evidence tetap tersedia
- historical failed inspection tidak berubah
- dashboard tidak rusak
- validation berhasil

---

# Output Required From Agent

Setelah selesai, laporkan hanya:

## Changed

File yang diubah.

## Fixed

Bug atau issue yang diperbaiki.

## Validation

Command/check yang dijalankan dan hasilnya.

## Remaining Issues

Hanya issue yang benar-benar ditemukan.

Jika tidak ada:

`None`

## CURRENT.md

Update `CURRENT.md` hanya jika implementation state memang berubah secara material.

---

# STOP CONDITION

Setelah TASK-001 selesai:

**STOP.**

Jangan:

- menambahkan feature baru
- redesign UI
- migrate architecture
- mengubah database structure tanpa kebutuhan
- melakukan cleanup seluruh repository
- melanjutkan task lain
- mengimplementasikan production deployment

Tunggu task berikutnya.

---

# BACKLOG

Backlog berikut **belum boleh dikerjakan** sampai TASK-001 selesai.

## TASK-002 — Mobile HSE Staff UX Review

Review pengalaman mobile untuk:

- Home
- assigned inspections
- Scan QR
- inspection checklist
- draft offline
- sync status
- photo evidence

Tujuan:

mengurangi langkah yang dibutuhkan HSE Staff saat inspeksi lapangan.

---

## TASK-003 — Offline / Sync Validation

Test:

- create draft offline
- reconnect
- pending sync
- successful sync
- duplicate prevention
- sync failure
- retry

Jangan redesign sync engine sebelum masalah aktual ditemukan.

---

## TASK-004 — Review Queue Validation

Test automatic inconsistency flags:

- duplicate inspection
- suspicious date
- site/equipment mismatch
- incomplete required data
- inconsistent measurement

Pastikan sistem tidak melakukan silent correction.

---

## TASK-005 — Dashboard Validation

Validasi:

- Checklist Compliance
- Inspection Completion
- Critical Findings
- Overdue Actions
- Site comparison

Pastikan compliance dan completion tidak digabung menjadi satu metric.

---

## TASK-006 — Report Validation

Validasi:

- CSV export
- print view
- PDF via print
- inspection details
- findings
- corrective-action status
- evidence references

---

## TASK-007 — Production Readiness Assessment

Belum implementasi.

Hanya assessment untuk:

- HTTPS
- persistent database
- production authentication
- backups
- security
- logging
- monitoring
- deployment
- multi-user concurrency
- production sync strategy

Hasil task ini harus berupa rekomendasi teknis sebelum coding production dimulai.

---

# Agent Prompt Template

Gunakan prompt berikut untuk setiap coding session:

```text
Read CURRENT.md first.

Then read TASK.md.

Work ONLY on the CURRENT TASK.

Inspect only files relevant to that task.

Use PLAN.md only if a product requirement needs clarification.

Do not redesign unrelated code.
Do not change architecture.
Do not implement backlog tasks.

Make the smallest safe change necessary.

Run relevant validation after the change.

Report:
1. Changed files
2. Fixed issues
3. Validation results
4. Remaining issues

Update CURRENT.md only if implementation state materially changed.

When the current task is complete, STOP.
```
