# Mizan HSE Cloudflare staging assessment

## Current runtime

The active implementation is `server.py`, a custom Python server built on:

- `http.server.SimpleHTTPRequestHandler`
- `http.server.ThreadingHTTPServer`
- `threading.RLock`
- local `sqlite3`
- local filesystem paths through `pathlib.Path`
- process-local session and operation handling

Static files are served directly from `public/` by the custom handler. The frontend uses IndexedDB for drafts and the pending synchronization queue, and sends JSON operations to `/api/*`. Evidence is currently sent as compressed base64 data inside JSON and persisted inside the SQLite JSON state document.

## Cloudflare compatibility

The following parts can remain conceptually unchanged:

- `public/` PWA assets and mobile UI
- browser IndexedDB drafts and synchronization queue
- JSON endpoint shapes (`/api/login`, `/api/session`, `/api/state`, `/api/operations`)
- role names and server-side workflow rules
- idempotent operation IDs and revision conflict checks
- immutable inspection answers and corrective-action history

The following parts cannot run in a Cloudflare Worker:

- `ThreadingHTTPServer` and `SimpleHTTPRequestHandler`; Workers use an event-driven `fetch` entrypoint.
- `sqlite3` database files; Worker instances cannot rely on a local persistent filesystem. Structured records must move to D1.
- `Path(...).mkdir()` and local `data/mizan.sqlite3`; data must be provisioned through D1 migrations.
- `threading.RLock`; each request must use D1 transactions/constraints rather than process locks.
- process-local sessions; sessions must be represented by secure cookies backed by D1 or another Cloudflare-bound store.
- base64 evidence in the structured state document; inspection and corrective-action photos should be uploaded to R2, with metadata in D1.
- long-running server state and background process assumptions; retries and synchronization must remain request/idempotent based.

## Target staging shape

`public/` remains the static asset directory. A Cloudflare Python Worker handles `/api/*`, binds `DB` to D1 and `EVIDENCE` to R2, and delegates all other requests to the static asset binding. The first migration must create users, sites, assets, inspections, answers, evidence metadata, findings, flags, activity history, sessions, and operations tables.

Python Workers are currently a beta Pyodide-based runtime. The supported setup uses `pyproject.toml`, `workers-py`, `workers-runtime-sdk`, `pywrangler`, a `python_workers` compatibility flag, and an async `WorkerEntrypoint.fetch` method. `sqlite3`, `http.server`, and thread locks must not be imported by that Worker entrypoint.

## Deployment prerequisites

The local environment currently has Node/npm but does not have `uv`, `pywrangler`, or an authenticated Wrangler session. An internet/tooling installation and Cloudflare login are required before a staging D1/R2 deployment can be created. No account ID, token, database ID, bucket name, or secret is embedded in this repository.

References: [Python Workers](https://developers.cloudflare.com/workers/languages/python/), [Python package management](https://developers.cloudflare.com/workers/languages/python/packages/), [Wrangler configuration and bindings](https://developers.cloudflare.com/workers/wrangler/configuration/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), and [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).

## TASK-002B D1 checkpoint

The Worker now uses the `DB` D1 binding configured in `cloudflare-worker/wrangler.jsonc`. Migrations are reproducible from `cloudflare-worker/migrations/0001_core.sql` and `0002_review_metadata.sql`; repeatable fictional seed data is in `cloudflare-worker/seed/demo.sql`.

The local SQLite state model maps to normalized D1 tables for users/sessions, sites, assets, inspections, inspection answers, findings, finding history, review flags, activity history, and idempotent operations. Historical inspection answers remain separate from corrective-action status. D1 operations and revision checks replace process-local idempotency/locking assumptions.

The Worker now migrates health, login/session/state, inspection submission, review, flag resolution, asset creation, corrective-action transitions, and evidence upload/retrieval. Binary evidence is stored in the local `EVIDENCE` R2 binding; D1 stores metadata and ownership relationships. Production D1/R2 IDs, production authentication, and remote deployment remain pending.

## TASK-002C evidence checkpoint

The local evidence path remains: browser compression → IndexedDB draft/operation queue → `/api/operations` JSON operation → Worker validation and R2 `put()` → D1 metadata batch. Inspection objects use `inspections/{inspection_id}/{evidence_id}.{ext}`; corrective-action objects use `findings/{finding_id}/{evidence_id}.{ext}`. Supported MIME types are JPEG, PNG, and WebP with a decoded 1.5 MB per-file limit and a maximum of eight files per operation.

The authenticated `/api/evidence/{evidence_id}` route checks the D1 relationship before returning the R2 object. Evidence IDs make retries idempotent, and failed D1 batches attempt compensating R2 deletion. Offline clients retain queued operations and their base64 payloads until the Worker confirms success. Remote staging and production authentication remain outside this checkpoint.

## TASK-002C-R Supabase adapter checkpoint

Staging and production now select `MIZAN_STORAGE_BACKEND=supabase`; development explicitly selects the existing local R2 adapter for rollback and local regression testing. The Supabase adapter uses server-only `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_BUCKET` values and the Storage HTTP object endpoint. D1 remains the source of evidence metadata, ownership, MIME type, size, uploader, timestamp, and deterministic object key. The authenticated Worker continues to proxy retrieval and perform compensating deletion after failed D1 persistence.

No Supabase project or credentials are present in this workspace, so upload/retrieval validation is pending credential provisioning. R2 is not bound in staging or production environments.

## TASK-002D authentication checkpoint

Cloud Worker authentication uses D1 users and sessions. Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes with 120,000 iterations; the Worker never returns hashes or plaintext credentials. Demo seed users are marked `is_demo=1` and are accepted only when `MIZAN_ENV=development`; staging and production environments reject them. Real deployments must provision individual users through an approved administrative process rather than seed SQL.

Sessions use random 48-byte URL-safe tokens, D1 expiry/revocation/last-seen fields, an eight-hour absolute lifetime, and a 30-minute inactivity timeout. Local cookies omit `Secure` for HTTP development; staging/production cookies include `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, and explicit `Max-Age`. Logout revokes the D1 row.

Mutations validate the request `Origin` and require the non-simple `X-Requested-With: mizan-hse` header, providing the current CSRF control without changing the offline queue contract. Failed login attempts are counted per user and locked for 15 minutes after five failures. API responses add `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and a camera-limited `Permissions-Policy`. Remote secrets, user provisioning, and deployment remain TASK-002E.
