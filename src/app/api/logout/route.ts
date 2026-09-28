import { NextResponse } from 'next/server';
import { COOKIE, cookieOptions, getRequestToken, logout } from '@/lib/auth';
import { jsonError, Problem } from '@/lib/problem';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) {
      throw new Problem('Cross-origin requests are not allowed.', 403);
    }
    await logout(await getRequestToken());
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, '', { ...cookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
