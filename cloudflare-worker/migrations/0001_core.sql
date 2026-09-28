PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('staff', 'manager', 'supervisor', 'management')),
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  type TEXT NOT NULL CHECK (type IN ('APAR', 'Hydrant', 'P3K')),
  zone TEXT NOT NULL,
  name TEXT NOT NULL,
  subtype TEXT NOT NULL DEFAULT '',
  capacity TEXT NOT NULL DEFAULT '',
  serial TEXT NOT NULL DEFAULT '',
  service_due TEXT NOT NULL DEFAULT '',
  expiry_date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
);

CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  asset_id TEXT REFERENCES assets(id),
  type TEXT NOT NULL CHECK (type IN ('APAR', 'Hydrant', 'P3K', 'Patrol')),
  zone TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL,
  inspection_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'returned')),
  inspector TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  template_version INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  missing INTEGER NOT NULL DEFAULT 0 CHECK (missing IN (0, 1)),
  observations_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  weight REAL,
  reference_weight REAL,
  minimum_weight REAL
);

CREATE TABLE IF NOT EXISTS inspection_answers (
  inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'na', 'missing', 'expired')),
  note TEXT NOT NULL DEFAULT '',
  quantity REAL,
  expiry TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (inspection_id, question_id)
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id),
  asset_id TEXT REFERENCES assets(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'awaiting_verification', 'closed')),
  due_date TEXT NOT NULL,
  owner TEXT NOT NULL,
  completion TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  completed_by TEXT REFERENCES users(id),
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL,
  sample INTEGER NOT NULL DEFAULT 0 CHECK (sample IN (0, 1))
);

CREATE TABLE IF NOT EXISTS finding_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('start', 'complete', 'verify', 'reject')),
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  at TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  resulting_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flags (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  resolution TEXT NOT NULL DEFAULT '',
  reviewer TEXT,
  resolved_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  actor TEXT NOT NULL,
  at TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  action TEXT
);

CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_assets_site ON assets(site_id);
CREATE INDEX IF NOT EXISTS idx_inspections_site_period ON inspections(site_id, period);
CREATE INDEX IF NOT EXISTS idx_answers_inspection ON inspection_answers(inspection_id);
CREATE INDEX IF NOT EXISTS idx_findings_status_site ON findings(status, site_id);
CREATE INDEX IF NOT EXISTS idx_findings_inspection ON findings(inspection_id);
CREATE INDEX IF NOT EXISTS idx_finding_history_finding ON finding_history(finding_id, id);
CREATE INDEX IF NOT EXISTS idx_flags_status_site ON flags(status, site_id);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity(at);
