import { addDays, ensureReady, getSql, getWorkspaceState, isoNow, logActivity, todayUtc } from './db';
import { Problem } from './problem';
import { INSPECTION_TYPES, InspectionType, TEMPLATES } from './templates';
import type { SessionUser } from './auth';

type Op = {
  id?: string;
  kind?: string;
  data?: Record<string, unknown>;
  expectedRevision?: number;
};

function allow(user: SessionUser, roles: string[]) {
  if (!roles.includes(user.role)) throw new Problem('Your role cannot perform this action.', 403);
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Problem('Use a valid date in YYYY-MM-DD format.');
  }
  return value;
}

function photos(values: unknown) {
  if (!Array.isArray(values) || values.length > 8) throw new Problem('Attach up to 8 photos.');
  for (const value of values) {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof (value as { data?: unknown }).data !== 'string' ||
      !['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'].some((p) =>
        String((value as { data: string }).data).startsWith(p),
      ) ||
      String((value as { data: string }).data).length > 2_000_000
    ) {
      throw new Problem('Use JPEG, PNG or WebP evidence under 1.5 MB per photo.');
    }
  }
  return values as { data: string; name?: string }[];
}

function validateInspection(state: Awaited<ReturnType<typeof getWorkspaceState>>, d: Record<string, unknown>) {
  if (typeof d.id !== 'string' || d.id.length < 8 || d.id.length > 100) {
    throw new Problem('Inspection ID is required.');
  }
  if (!INSPECTION_TYPES.includes(d.type as InspectionType) || !state.sites.some((s) => s.id === d.siteId)) {
    throw new Problem('Select a valid checklist and site.');
  }
  parseDate(d.date);
  if (typeof d.period !== 'string' || !/^\d{4}-\d{2}$/.test(d.period)) {
    throw new Problem('A valid inspection period is required.');
  }
  const type = d.type as InspectionType;
  if (type !== 'Patrol') {
    const asset = state.assets.find((x) => x.id === d.assetId);
    if (!asset || asset.type !== type) throw new Problem('Select equipment matching the checklist type.');
  } else if (typeof d.zone !== 'string' || !d.zone.trim()) {
    throw new Problem('Enter the patrol area.');
  }
  photos(d.photos || []);
  const answers = d.answers;
  const expected = new Set(TEMPLATES[type].items.map((q) => q.id));
  if (!Array.isArray(answers) || answers.length !== expected.size || new Set(answers.map((a: { id?: string }) => a.id)).size !== expected.size) {
    throw new Problem('Every checklist question needs exactly one answer.');
  }
  for (const a of answers as { id: string }[]) {
    if (!expected.has(a.id)) throw new Problem('Every checklist question needs exactly one answer.');
  }
  if (d.missing) {
    if (
      type === 'Patrol' ||
      typeof d.notes !== 'string' ||
      !d.notes.trim() ||
      !Array.isArray(d.photos) ||
      !d.photos.length ||
      (answers as { status?: string }[]).some((a) => a.status !== 'missing')
    ) {
      throw new Problem('Missing equipment requires all checks marked missing, a note and a location photo.');
    }
  }
  for (const a of answers as Record<string, unknown>[]) {
    if (!['pass', 'fail', 'na', 'missing', 'expired'].includes(String(a.status))) {
      throw new Problem('Complete every required checklist answer.');
    }
    if (a.status !== 'pass' && !String(a.note || '').trim()) {
      throw new Problem('A reason is required for every failed, missing, expired or N/A answer.');
    }
    const q = TEMPLATES[type].items.find((item) => item.id === a.id)!;
    if (
      'required' in q &&
      q.required &&
      a.status !== 'na' &&
      a.status !== 'missing' &&
      (typeof a.quantity !== 'number' || a.quantity < 0)
    ) {
      throw new Problem('Enter a non-negative actual quantity for each P3K supply.');
    }
    if (a.expiry) parseDate(a.expiry);
    if (a.id === 'weight' && (a.status === 'pass' || a.status === 'fail')) {
      for (const key of ['weight', 'referenceWeight', 'minimumWeight']) {
        if (!(Number(d[key]) > 0)) {
          throw new Problem('Enter measured, reference and minimum acceptable CO₂ weights in kg.');
        }
      }
      if (!Array.isArray(d.photos) || !d.photos.length) {
        throw new Problem('Attach weighing evidence for a CO₂ weight check.');
      }
    }
  }
  const observations = d.observations || [];
  if (!Array.isArray(observations) || observations.length > 30) {
    throw new Problem('Use up to 30 observations per inspection.');
  }
  for (const o of observations as Record<string, unknown>[]) {
    if (
      !String(o.title || '').trim() ||
      !['safe', 'unsafe'].includes(String(o.condition)) ||
      !['low', 'medium', 'high', 'critical'].includes(String(o.severity || 'medium'))
    ) {
      throw new Problem('Each observation needs a title, condition and valid severity.');
    }
  }
  const failed = (answers as { status: string }[]).some((a) => ['fail', 'missing', 'expired'].includes(a.status));
  const unsafe = (observations as { condition?: string }[]).some((o) => o.condition === 'unsafe');
  if ((failed || unsafe) && (!Array.isArray(d.photos) || !d.photos.length)) {
    throw new Problem('Attach at least one evidence photo for failed checks or unsafe observations.');
  }
}

export async function applyOperation(user: SessionUser, op: Op) {
  await ensureReady();
  if (!op || typeof op.id !== 'string' || op.id.length < 8 || op.id.length > 100) {
    throw new Problem('A unique operation ID is required.');
  }
  const sql = getSql();
  const prior = await sql`SELECT user_id, result FROM operations WHERE id = ${op.id}`;
  if (prior[0]) {
    if (String(prior[0].user_id) !== user.id) throw new Problem('Operation belongs to another account.', 403);
    return prior[0].result as Record<string, unknown>;
  }

  const state = await getWorkspaceState();
  const result = await mutate(state, user, op);
  await sql`INSERT INTO operations (id, user_id, result) VALUES (${op.id}, ${user.id}, ${result as never})`;
  await logActivity(user.name, String(result.message));
  return result;
}

async function mutate(state: Awaited<ReturnType<typeof getWorkspaceState>>, user: SessionUser, op: Op) {
  const sql = getSql();
  const kind = op.kind;
  const d = (op.data || {}) as Record<string, unknown>;

  if (kind === 'create_inspection') {
    allow(user, ['staff', 'manager', 'supervisor']);
    validateInspection(state, d);
    const existing = await sql`SELECT id FROM inspections WHERE id = ${String(d.id)}`;
    if (existing[0]) throw new Problem('Inspection already exists.', 409);
    const type = d.type as InspectionType;
    const answers = d.answers as { id: string; status: string; note?: string; quantity?: number; expiry?: string }[];
    const flags: string[] = [];
    if (String(d.date).slice(0, 7) !== d.period) flags.push('Inspection date differs from the scheduled period');
    if (String(d.date) > todayUtc()) flags.push('Inspection date is in the future; check device date');
    if (d.assetId && state.inspections.some((x) => x.assetId === d.assetId && x.period === d.period && x.type === d.type)) {
      flags.push('Potential duplicate inspection for this equipment and period');
    }
    const asset = state.assets.find((x) => x.id === d.assetId);
    if (asset && asset.siteId !== d.siteId) flags.push('Equipment site differs from inspection site');
    for (const a of answers) {
      const q = TEMPLATES[type].items.find((item) => item.id === a.id)!;
      if (a.status === 'pass' && 'required' in q && q.required && Number(a.quantity || 0) < Number(q.required)) {
        flags.push(`Pass conflicts with quantity: ${q.label}`);
      }
      if (a.status === 'pass' && a.expiry && a.expiry < String(d.date)) flags.push(`Pass conflicts with expiry: ${q.label}`);
      if (a.id === 'service' && a.status === 'pass' && asset?.serviceDue && asset.serviceDue < String(d.date)) {
        flags.push('Pass conflicts with overdue equipment service');
      }
      if (
        a.id === 'weight' &&
        a.status === 'pass' &&
        d.minimumWeight != null &&
        Number(d.weight) < Number(d.minimumWeight)
      ) {
        flags.push('Pass conflicts with the minimum acceptable CO₂ weight');
      }
    }
    const now = isoNow();
    await sql`INSERT INTO inspections (
      id, site_id, asset_id, type, zone, period, date, status, answers, photos, observations,
      weight, reference_weight, minimum_weight, notes, missing, inspector, created_by, created_at, updated_at,
      revision, template_version, sample
    ) VALUES (
      ${String(d.id)}, ${String(d.siteId)}, ${d.assetId ? String(d.assetId) : null}, ${type}, ${String(d.zone || asset?.zone || '')},
      ${String(d.period)}, ${String(d.date)}, ${'submitted'}, ${answers as never}, ${(d.photos || []) as never},
      ${(d.observations || []) as never}, ${d.weight == null ? null : Number(d.weight)},
      ${d.referenceWeight == null ? null : Number(d.referenceWeight)}, ${d.minimumWeight == null ? null : Number(d.minimumWeight)},
      ${String(d.notes || '')}, ${Boolean(d.missing)}, ${user.name}, ${user.id}, ${now}, ${now}, 1, ${TEMPLATES[type].version}, false
    )`;
    for (const reason of flags) {
      await sql`INSERT INTO flags (id, inspection_id, site_id, reason, status, revision, created_at)
        VALUES (${crypto.randomUUID()}, ${String(d.id)}, ${String(d.siteId)}, ${reason}, ${'open'}, 1, ${now})`;
    }
    const failed = answers.filter((a) => ['fail', 'missing', 'expired'].includes(a.status));
    const findings: [string, string, string][] = d.missing
      ? [['Equipment missing', String(d.notes || ''), 'high']]
      : failed.map((a) => {
          const q = TEMPLATES[type].items.find((item) => item.id === a.id)!;
          return [q.label, String(a.note || ''), 'medium'];
        });
    for (const o of (d.observations || []) as { title?: string; note?: string; severity?: string; condition?: string }[]) {
      if (o.condition === 'unsafe') findings.push([String(o.title), String(o.note || ''), String(o.severity || 'medium')]);
    }
    const due = addDays(new Date(), 7);
    for (const [title, detail, severity] of findings) {
      await sql`INSERT INTO findings (
        id, inspection_id, asset_id, site_id, title, detail, severity, status, due_date, owner,
        photos, completion, evidence, history, revision, created_at, sample
      ) VALUES (
        ${crypto.randomUUID()}, ${String(d.id)}, ${d.assetId ? String(d.assetId) : null}, ${String(d.siteId)},
        ${title}, ${detail}, ${severity}, ${'open'}, ${due}, ${'HSE Manager'}, ${(d.photos || []) as never},
        ${''}, ${[] as never}, ${[] as never}, 1, ${now}, false
      )`;
    }
    return { message: `${type} inspection submitted · ${findings.length} findings`, id: d.id, flags: flags.length };
  }

  if (kind === 'review_inspection') {
    allow(user, ['manager', 'supervisor']);
    const rows = await sql`SELECT * FROM inspections WHERE id = ${String(d.id)}`;
    const ins = rows[0];
    if (!ins) throw new Problem('Record not found.', 404);
    if (op.expectedRevision !== Number(ins.revision)) {
      throw new Problem(
        'This record changed since your last sync. Your changes are preserved locally. Refresh and review before retrying.',
        409,
      );
    }
    if (ins.status !== 'submitted') throw new Problem('Only submitted inspections can be reviewed.');
    if (d.decision !== 'approved' && d.decision !== 'returned') throw new Problem('Select an approval decision.');
    if (d.decision === 'approved') {
      const open = await sql`SELECT id FROM flags WHERE inspection_id = ${ins.id} AND status = 'open'`;
      if (open.length) throw new Problem('Resolve the data review flags before approval.');
    }
    if (d.decision === 'returned' && !String(d.note || '').trim()) {
      throw new Problem('Provide a reason for returning the inspection.');
    }
    await sql`UPDATE inspections SET
      status = ${String(d.decision)},
      review_note = ${String(d.note || '')},
      reviewer = ${user.name},
      reviewed_at = ${isoNow()},
      revision = revision + 1,
      updated_at = ${isoNow()}
      WHERE id = ${ins.id}`;
    return { message: `${ins.type} inspection ${d.decision}` };
  }

  if (kind === 'finding_action') {
    const rows = await sql`SELECT * FROM findings WHERE id = ${String(d.id)}`;
    const f = rows[0];
    if (!f) throw new Problem('Record not found.', 404);
    if (op.expectedRevision !== Number(f.revision)) {
      throw new Problem(
        'This record changed since your last sync. Your changes are preserved locally. Refresh and review before retrying.',
        409,
      );
    }
    const action = String(d.action);
    let status = String(f.status);
    let completion = String(f.completion || '');
    let evidence = f.evidence;
    let completedBy = f.completed_by;
    let verifiedBy = f.verified_by;
    let verifiedAt = f.verified_at;
    if (action === 'start' || action === 'complete') {
      allow(user, ['manager']);
      if (!['open', 'in_progress'].includes(status)) {
        throw new Problem('This finding is not available for corrective work.');
      }
      if (action === 'complete') {
        if (!String(d.note || '').trim() || !d.evidence) {
          throw new Problem('Completion notes and at least one evidence photo are required.');
        }
        photos(d.evidence);
        status = 'awaiting_verification';
        completion = String(d.note);
        evidence = d.evidence;
        completedBy = user.id;
      } else {
        status = 'in_progress';
      }
    } else if (action === 'verify' || action === 'reject') {
      allow(user, ['supervisor']);
      if (status !== 'awaiting_verification') throw new Problem('The finding must await verification first.');
      if (f.completed_by === user.id) throw new Problem('You cannot verify your own corrective work.', 403);
      if (!String(d.note || '').trim()) throw new Problem('A verification or rejection note is required.');
      status = action === 'verify' ? 'closed' : 'in_progress';
      verifiedBy = action === 'verify' ? user.name : null;
      verifiedAt = action === 'verify' ? isoNow() : null;
    } else {
      throw new Problem('Unknown finding action.');
    }
    const history = Array.isArray(f.history) ? f.history : [];
    history.push({ action, note: String(d.note || ''), actor: user.name, at: isoNow() });
    await sql`UPDATE findings SET
      status = ${status},
      completion = ${completion},
      evidence = ${(evidence || []) as never},
      completed_by = ${completedBy},
      verified_by = ${verifiedBy},
      verified_at = ${verifiedAt},
      history = ${history as never},
      revision = revision + 1
      WHERE id = ${f.id}`;
    return { message: `Corrective action: ${f.title} · ${status.replaceAll('_', ' ')}` };
  }

  if (kind === 'resolve_flag') {
    allow(user, ['manager', 'supervisor']);
    const rows = await sql`SELECT * FROM flags WHERE id = ${String(d.id)}`;
    const f = rows[0];
    if (!f) throw new Problem('Record not found.', 404);
    if (op.expectedRevision !== Number(f.revision)) {
      throw new Problem(
        'This record changed since your last sync. Your changes are preserved locally. Refresh and review before retrying.',
        409,
      );
    }
    if (!String(d.note || '').trim()) throw new Problem('Document the reason for resolving this flag.');
    if (f.status !== 'open') throw new Problem('This flag has already been resolved.');
    await sql`UPDATE flags SET
      status = ${'resolved'},
      resolution = ${String(d.note)},
      reviewer = ${user.name},
      resolved_at = ${isoNow()},
      revision = revision + 1
      WHERE id = ${f.id}`;
    return { message: 'Data review flag resolved with a recorded explanation' };
  }

  if (kind === 'create_asset') {
    allow(user, ['manager', 'supervisor']);
    for (const field of ['id', 'name', 'siteId', 'type', 'zone', 'dueDate']) {
      if (typeof d[field] !== 'string' || !String(d[field]).trim()) throw new Problem(`${field} is required.`);
    }
    if (!['APAR', 'Hydrant', 'P3K'].includes(String(d.type)) || !state.sites.some((s) => s.id === d.siteId)) {
      throw new Problem('Invalid equipment type or site.');
    }
    const clash = await sql`SELECT id FROM assets WHERE lower(id) = ${String(d.id).toLowerCase()}`;
    if (clash[0]) throw new Problem('Equipment ID already exists.', 409);
    for (const field of ['dueDate', 'serviceDue', 'expiryDate']) {
      if (d[field]) parseDate(d[field]);
    }
    await sql`INSERT INTO assets (
      id, site_id, type, zone, name, subtype, capacity, serial, due_date, service_due, expiry_date, revision
    ) VALUES (
      ${String(d.id).trim()}, ${String(d.siteId)}, ${String(d.type)}, ${String(d.zone).trim()}, ${String(d.name).trim()},
      ${String(d.subtype || '')}, ${String(d.capacity || '')}, ${String(d.serial || '')},
      ${String(d.dueDate)}, ${d.serviceDue ? String(d.serviceDue) : null}, ${d.expiryDate ? String(d.expiryDate) : null}, 1
    )`;
    return { message: `Equipment ${d.id} registered` };
  }

  throw new Problem('Unknown operation.');
}
