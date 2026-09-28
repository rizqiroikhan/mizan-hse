import { getRequestUser } from '@/lib/auth';
import { applyOperation } from '@/lib/operations';
import { jsonError, Problem } from '@/lib/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) {
      throw new Problem('Cross-origin requests are not allowed.', 403);
    }
    const user = await getRequestUser();
    const data = await request.json();
    if (!data || typeof data !== 'object') throw new Problem('JSON object required.');
    return Response.json(await applyOperation(user, data));
  } catch (error) {
    return jsonError(error);
  }
}
