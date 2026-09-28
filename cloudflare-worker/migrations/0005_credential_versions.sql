ALTER TABLE users ADD COLUMN credential_version TEXT NOT NULL DEFAULT 'pbkdf2_sha256_v1_120k';
ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 120000;

UPDATE users
SET credential_version='pbkdf2_sha256_v1_120k', password_iterations=120000
WHERE credential_version='';
