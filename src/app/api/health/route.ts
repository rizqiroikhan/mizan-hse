import { jsonError } from '@/lib/problem';
import { ensureReady } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureReady();
    return Response.json({ ok: true, database: 'neon' });
  } catch (error) {
    return jsonError(error);
  }
}
