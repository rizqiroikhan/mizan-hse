import { getRequestUser } from '@/lib/auth';
import { jsonError } from '@/lib/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getRequestUser();
    return Response.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}
