import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { ensureReady, getSql, isoNow, passwordsMatch } from './db';
import { Problem } from './problem';

export type SessionUser = { id: string; name: string; role: string };

const COOKIE = 'mizan_session';

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production' || process.env.MIZAN_SECURE_COOKIE === '1',
  };
}

export async function login(userId: string, password: string) {
  await ensureReady();
  const sql = getSql();
  const rows = await sql`SELECT id, name, role, salt, hash FROM users WHERE id = ${userId}`;
  const row = rows[0];
  if (!row || !passwordsMatch(password, String(row.salt), String(row.hash))) {
    throw new Problem('Incorrect account or password.', 401);
  }
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sql`INSERT INTO sessions (token, user_id, expires) VALUES (${token}, ${row.id}, ${expires})`;
  return { token, user: { id: String(row.id), name: String(row.name), role: String(row.role) } };
}

export async function logout(token: string) {
  if (!token) return;
  await ensureReady();
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export async function userFromToken(token: string): Promise<SessionUser> {
  await ensureReady();
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.name, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires > ${isoNow()}
  `;
  const row = rows[0];
  if (!row) throw new Problem('Please sign in online to continue synchronizing.', 401);
  return { id: String(row.id), name: String(row.name), role: String(row.role) };
}

export async function getRequestUser() {
  const token = (await cookies()).get(COOKIE)?.value || '';
  return userFromToken(token);
}

export async function getRequestToken() {
  return (await cookies()).get(COOKIE)?.value || '';
}

export { COOKIE };
