-- Fictional, repeatable local/pilot seed data. Never use these demo credentials in production.
INSERT OR IGNORE INTO users (id, name, role, salt, password_hash, created_at) VALUES
  ('staff', 'HSE Staff', 'staff', 'mizan-seed-staff', 'fdc57ec5828c558580f341ad32accb9028aac7a32eb634d2a576c3e5021d94aa', '2026-09-27T00:00:00+00:00'),
  ('manager', 'HSE Supervisor', 'manager', 'mizan-seed-manager', 'ebb0abb44955b020db43aa9208d9a5f53cf36214889224d7dbb3fca06a2fbceb', '2026-09-27T00:00:00+00:00'),
  ('supervisor', 'HSE Manager', 'supervisor', 'mizan-seed-supervisor', '16b7c0cfb04c19199d40543526624942b6e3c6976a24f9cefc7b1dd3a69992c8', '2026-09-27T00:00:00+00:00'),
  ('management', 'Management', 'management', 'mizan-seed-management', '9a4daa342f10c8f5ed4ada69c596865bf21eb526c75a19327c994ad777c576c3', '2026-09-27T00:00:00+00:00');

INSERT OR IGNORE INTO sites (id, name, city, code) VALUES
  ('dukuh', 'JPM Dukuh Atas', 'Jakarta', 'JPM'),
  ('sentral', 'Sentral Office', 'Jakarta', 'SNT'),
  ('depot', 'East Operations Depot', 'Bekasi', 'EOD');

INSERT OR IGNORE INTO assets (id, site_id, type, zone, name, subtype, capacity, serial, service_due, expiry_date, due_date, revision) VALUES
  ('JPM-APAR-01', 'dukuh', 'APAR', 'Zone 1', 'APAR 01', 'Dry chemical', '5 kg', 'DEMO-1001', '2026-10-15', '', '2026-09-30', 1),
  ('JPM-APAR-02', 'dukuh', 'APAR', 'Zone 2', 'APAR 02', 'Dry chemical', '5 kg', 'DEMO-1002', '2026-10-15', '', '2026-09-30', 1),
  ('JPM-HYDRANT-01', 'dukuh', 'Hydrant', 'Zone 1', 'Hydrant 01', '', '', 'DEMO-H001', '', '', '2026-09-30', 1),
  ('JPM-P3K-01', 'dukuh', 'P3K', 'Zone 1', 'P3K 01', '', '', 'DEMO-P001', '', '', '2026-09-30', 1);

INSERT OR IGNORE INTO activity (id, text, actor, at, entity_type, entity_id, action) VALUES
  ('welcome', 'Demo workspace created with fictional inspection results', 'System', '2026-09-27T00:00:00+00:00', 'workspace', NULL, 'seed');
