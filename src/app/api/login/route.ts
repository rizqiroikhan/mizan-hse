import { NextResponse } from 'next/server';
import { COOKIE, cookieOptions, login } from '@/lib/auth';
import { jsonError, Problem } from '@/lib/problem';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) {
      throw new Problem('Cross-origin requests are not allowed.', 403);
    }
    const data = await request.json();
    const result = await login(String(data.user || ''), String(data.password || ''));
    const response = NextResponse.json({ user: result.user });
    response.cookies.set(COOKIE, result.token, { ...cookieOptions(), maxAge: 604800 });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
