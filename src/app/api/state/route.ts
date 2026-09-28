import { getRequestUser } from '@/lib/auth';
import { getWorkspaceState } from '@/lib/db';
import { jsonError } from '@/lib/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getRequestUser();
    return Response.json(await getWorkspaceState());
  } catch (error) {
    return jsonError(error);
  }
}
