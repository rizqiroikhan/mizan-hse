## Usage

The Mizan Worker can be run locally from WSL2 with:

```bash
uv run pywrangler dev
```

Apply the reproducible local D1 schema and fictional seed data before starting the Worker:

```bash
npx wrangler d1 migrations apply mizan-hse-staging --local
npx wrangler d1 execute mizan-hse-staging --local --file=./seed/demo.sql
```

The local Worker is served at `http://127.0.0.1:8787`. The `DB` binding uses a local placeholder database ID for development; replace it with a real Cloudflare D1 database ID before remote staging deployment. The local `EVIDENCE` R2 binding uses `mizan-hse-evidence-local`; replace the bucket name for remote staging. Evidence uploads are handled through `/api/operations` and retrieved through authenticated `/api/evidence/{evidence_id}` requests.

Wrangler environments set `MIZAN_ENV=development` locally and non-development values for staging/production. Demo seed credentials are rejected outside development. Development uses the local R2 fallback; staging/production use Supabase Storage through the `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_BUCKET` configuration. Set the first two with server-only secrets and never expose them to the browser. Remote deployment must provision individual user credentials before using `wrangler deploy --env staging`.

### Types and autocomplete

This project also includes a pyproject.toml file with some requirements which
set up autocomplete and type hints for this Python Workers project.

To get these installed you'll need `uv`, which you can install by following
https://docs.astral.sh/uv/getting-started/installation/.

Once `uv` is installed, you can run the following:

```
uv venv
uv sync
```

Then point your editor's Python plugin at the `.venv` directory. You should then have working
autocomplete and type information in your editor.
