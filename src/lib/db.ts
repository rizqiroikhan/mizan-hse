import { neon } from '@neondatabase/serverless';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { Problem } from './problem';
import { SITES, TEMPLATES } from './templates';

type Sql = ReturnType<typeof neon>;

let cached: Sql | null = null;
let ready: Promise<void> | null = null;

export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Problem(
      'DATABASE_URL is not set. Add your Neon connection string in .env.local (local) or Vercel environment variables.',
      503,
    );
  }
  if (!cached) cached = neon(url);
  return cached;
}

export function passwordHash(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
}

export function passwordsMatch(password: string, salt: string, hash: string) {
  const actual = Buffer.from(passwordHash(password, salt), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isoNow() {
  return new Date().toISOString();
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function migrate(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    code TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id),
    type TEXT NOT NULL,
    zone TEXT NOT NULL,
    name TEXT NOT NULL,
    subtype TEXT DEFAULT '',
    capacity TEXT DEFAULT '',
    serial TEXT DEFAULT '',
    service_due DATE,
    expiry_date DATE,
    due_date DATE,
    revision INTEGER NOT NULL DEFAULT 1
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    asset_id TEXT,
    type TEXT NOT NULL,
    zone TEXT DEFAULT '',
    period TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    answers JSONB NOT NULL DEFAULT '[]',
    photos JSONB NOT NULL DEFAULT '[]',
    observations JSONB NOT NULL DEFAULT '[]',
    weight NUMERIC,
    reference_weight NUMERIC,
    minimum_weight NUMERIC,
    notes TEXT DEFAULT '',
    missing BOOLEAN DEFAULT FALSE,
    inspector TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    revision INTEGER NOT NULL DEFAULT 1,
    template_version INTEGER NOT NULL DEFAULT 1,
    sample BOOLEAN DEFAULT FALSE,
    review_note TEXT,
    reviewer TEXT,
    reviewed_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    inspection_id TEXT,
    asset_id TEXT,
    site_id TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT DEFAULT '',
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    due_date DATE,
    owner TEXT,
    photos JSONB NOT NULL DEFAULT '[]',
    completion TEXT DEFAULT '',
    evidence JSONB NOT NULL DEFAULT '[]',
    history JSONB NOT NULL DEFAULT '[]',
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ,
    sample BOOLEAN DEFAULT FALSE,
    completed_by TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS flags (
    id TEXT PRIMARY KEY,
    inspection_id TEXT,
    site_id TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ,
    resolution TEXT,
    reviewer TEXT,
    resolved_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    actor TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    result JSONB NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS workspace_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL DEFAULT 1,
    demo BOOLEAN NOT NULL DEFAULT TRUE
  )`;
}

async function seedIfEmpty(sql: Sql) {
  const users = await sql`SELECT id FROM users LIMIT 1`;
  if (users.length) return;

  const password = process.env.MIZAN_DEMO_PASSWORD || 'MizanDemo2026!';
  const names: Record<string, string> = {
    staff: 'HSE Staff',
    manager: 'HSE Manager',
    supervisor: 'HSE Supervisor',
    management: 'Management',
  };
  for (const role of Object.keys(names)) {
    const salt = randomBytes(16).toString('hex');
    await sql`INSERT INTO users (id, name, role, salt, hash)
      VALUES (${role}, ${names[role]}, ${role}, ${salt}, ${passwordHash(password, salt)})`;
  }

  for (const site of SITES) {
    await sql`INSERT INTO sites (id, name, city, code)
      VALUES (${site.id}, ${site.name}, ${site.city}, ${site.code})`;
  }

  const day = new Date();
  day.setUTCHours(12, 0, 0, 0);
  const dueSoon = addDays(day, 4);

  for (const [siteIndex, site] of SITES.entries()) {
    for (const [kind, count] of [
      ['APAR', 6],
      ['Hydrant', 3],
      ['P3K', 2],
    ] as const) {
      for (let n = 1; n <= count; n++) {
        const aid = `${site.code}-${kind.toUpperCase()}-${String(n).padStart(2, '0')}`;
        const subtype = kind === 'APAR' ? (n === 6 ? 'CO2' : 'Dry chemical') : '';
        const capacity = kind === 'APAR' ? '5 kg' : '';
        const serviceDue = kind === 'APAR' ? addDays(day, 22 + n * 12) : null;
        await sql`INSERT INTO assets (
          id, site_id, type, zone, name, subtype, capacity, serial, service_due, expiry_date, due_date, revision
        ) VALUES (
          ${aid}, ${site.id}, ${kind}, ${`Zone ${((n - 1) % 3) + 1}`}, ${`${kind} ${String(n).padStart(2, '0')}`},
          ${subtype}, ${capacity}, ${`DEMO-${siteIndex + 1}${String(n).padStart(3, '0')}`},
          ${serviceDue}, ${null}, ${dueSoon}, 1
        )`;

        if (n <= (kind === 'APAR' ? 4 : 2)) {
          const date = addDays(day, -(1 + siteIndex + n));
          const items = TEMPLATES[kind].items;
          const answers = items.map((q, idx) => {
            let status = 'conditional' in q && q.conditional === 'co2' ? 'na' : 'pass';
            if (idx === 1 && n === 2) status = 'fail';
            return {
              id: q.id,
              status,
              note:
                status === 'fail'
                  ? 'Illustrative finding; sample evidence only.'
                  : status === 'na'
                    ? 'Not fitted on this equipment type'
                    : '',
              quantity: 'required' in q ? q.required : null,
              expiry: '',
            };
          });
          const iid = `demo-${aid}`;
          await sql`INSERT INTO inspections (
            id, site_id, asset_id, type, zone, period, date, status, answers, photos, observations,
            inspector, created_by, created_at, updated_at, revision, template_version, sample
          ) VALUES (
            ${iid}, ${site.id}, ${aid}, ${kind}, ${`Zone ${((n - 1) % 3) + 1}`},
            ${day.toISOString().slice(0, 7)}, ${date}, ${'approved'}, ${answers as never},
            ${[] as never}, ${[] as never}, ${'Demo inspector'}, ${'staff'},
            ${`${date}T09:00:00.000Z`}, ${isoNow()}, 1, 1, true
          )`;

          if (n === 2) {
            const title =
              kind === 'APAR'
                ? 'Access to extinguisher obstructed'
                : kind === 'Hydrant'
                  ? 'Fire hose needs replacement'
                  : 'First aid supplies below required quantity';
            const status =
              siteIndex === 0 && kind === 'P3K'
                ? 'awaiting_verification'
                : kind === 'APAR'
                  ? 'in_progress'
                  : 'open';
            const due = addDays(day, kind === 'Hydrant' ? -2 : 3);
            const completion =
              siteIndex === 0 && kind === 'P3K' ? 'Supplies replenished (demonstration).' : '';
            const severity = kind === 'Hydrant' ? 'high' : 'medium';
            await sql`INSERT INTO findings (
              id, inspection_id, asset_id, site_id, title, detail, severity, status, due_date, owner,
              photos, completion, evidence, history, revision, created_at, sample
            ) VALUES (
              ${`f-${aid}`}, ${iid}, ${aid}, ${site.id}, ${title},
              ${'Demonstration finding. Inspect the actual equipment before use.'},
              ${severity}, ${status}, ${due}, ${'HSE Manager'}, ${[] as never}, ${completion},
              ${[] as never}, ${[] as never}, 1, ${date}, true
            )`;
          }
        }
      }
    }
  }

  await sql`INSERT INTO activity (id, text, actor, at) VALUES (
    ${'welcome'}, ${'Demo workspace created with fictional inspection results'}, ${'System'}, ${isoNow()}
  )`;
  await sql`INSERT INTO workspace_meta (id, revision, demo) VALUES (1, 1, true)`;
}

export async function ensureReady() {
  if (!ready) {
    ready = (async () => {
      const sql = getSql();
      await migrate(sql);
      await seedIfEmpty(sql);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

function asDate(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function asIso(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function getWorkspaceState() {
  await ensureReady();
  const sql = getSql();
  const [sites, assets, inspections, findings, flags, activity, meta] = await Promise.all([
    sql`SELECT * FROM sites ORDER BY name`,
    sql`SELECT * FROM assets ORDER BY id`,
    sql`SELECT * FROM inspections ORDER BY created_at DESC`,
    sql`SELECT * FROM findings ORDER BY created_at DESC`,
    sql`SELECT * FROM flags ORDER BY created_at DESC`,
    sql`SELECT * FROM activity ORDER BY at DESC LIMIT 100`,
    sql`SELECT revision, demo FROM workspace_meta WHERE id = 1`,
  ]);

  return {
    sites,
    templates: TEMPLATES,
    assets: assets.map((a) => ({
      id: a.id,
      siteId: a.site_id,
      type: a.type,
      zone: a.zone,
      name: a.name,
      subtype: a.subtype || '',
      capacity: a.capacity || '',
      serial: a.serial || '',
      serviceDue: asDate(a.service_due),
      expiryDate: asDate(a.expiry_date),
      dueDate: asDate(a.due_date),
      revision: Number(a.revision),
    })),
    inspections: inspections.map((i) => ({
      id: i.id,
      siteId: i.site_id,
      assetId: i.asset_id,
      type: i.type,
      zone: i.zone || '',
      period: i.period,
      date: asDate(i.date),
      status: i.status,
      answers: i.answers || [],
      photos: i.photos || [],
      observations: i.observations || [],
      weight: i.weight == null ? undefined : Number(i.weight),
      referenceWeight: i.reference_weight == null ? undefined : Number(i.reference_weight),
      minimumWeight: i.minimum_weight == null ? undefined : Number(i.minimum_weight),
      notes: i.notes || '',
      missing: Boolean(i.missing),
      inspector: i.inspector,
      createdBy: i.created_by,
      createdAt: asIso(i.created_at),
      updatedAt: asIso(i.updated_at),
      revision: Number(i.revision),
      templateVersion: Number(i.template_version),
      sample: Boolean(i.sample),
      reviewNote: i.review_note || '',
      reviewer: i.reviewer,
      reviewedAt: i.reviewed_at ? asIso(i.reviewed_at) : undefined,
    })),
    findings: findings.map((f) => ({
      id: f.id,
      inspectionId: f.inspection_id,
      assetId: f.asset_id,
      siteId: f.site_id,
      title: f.title,
      detail: f.detail || '',
      severity: f.severity,
      status: f.status,
      dueDate: asDate(f.due_date),
      owner: f.owner,
      photos: f.photos || [],
      completion: f.completion || '',
      evidence: f.evidence || [],
      history: f.history || [],
      revision: Number(f.revision),
      createdAt: asDate(f.created_at) || asIso(f.created_at),
      sample: Boolean(f.sample),
      completedBy: f.completed_by,
      verifiedBy: f.verified_by,
      verifiedAt: f.verified_at ? asIso(f.verified_at) : undefined,
    })),
    flags: flags.map((f) => ({
      id: f.id,
      inspectionId: f.inspection_id,
      siteId: f.site_id,
      reason: f.reason,
      status: f.status,
      revision: Number(f.revision),
      createdAt: asIso(f.created_at),
      resolution: f.resolution,
      reviewer: f.reviewer,
      resolvedAt: f.resolved_at ? asIso(f.resolved_at) : undefined,
    })),
    activity: activity.map((a) => ({
      id: a.id,
      text: a.text,
      actor: a.actor,
      at: asIso(a.at),
    })),
    revision: Number(meta[0]?.revision || 1),
    demo: Boolean(meta[0]?.demo ?? true),
    serverTime: isoNow(),
  };
}

export async function logActivity(actor: string, text: string) {
  const sql = getSql();
  const id = crypto.randomUUID();
  await sql`INSERT INTO activity (id, text, actor, at) VALUES (${id}, ${text}, ${actor}, ${isoNow()})`;
  await sql`DELETE FROM activity WHERE id NOT IN (
    SELECT id FROM (SELECT id FROM activity ORDER BY at DESC LIMIT 100) keep
  )`;
  await sql`UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1`;
}
