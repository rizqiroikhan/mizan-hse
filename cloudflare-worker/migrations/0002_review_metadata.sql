ALTER TABLE inspections ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
ALTER TABLE inspections ADD COLUMN reviewer TEXT;
ALTER TABLE inspections ADD COLUMN reviewed_at TEXT;
