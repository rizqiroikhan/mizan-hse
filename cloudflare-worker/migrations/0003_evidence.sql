CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('inspection','finding')),
  owner_id TEXT NOT NULL,
  inspection_id TEXT REFERENCES inspections(id) ON DELETE CASCADE,
  finding_id TEXT REFERENCES findings(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'inspection',
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stored' CHECK (status IN ('stored','failed'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_owner ON evidence(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_evidence_inspection ON evidence(inspection_id);
CREATE INDEX IF NOT EXISTS idx_evidence_finding ON evidence(finding_id);
