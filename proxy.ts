import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

const SESSION_COOKIE = 'familyds_session';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET || '');
}

async function readSession(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req);
  if (pathname.startsWith('/admin')) {
    if (!session) return NextResponse.redirect(new URL('/auth/login', req.url));
    if (session.role !== 'admin') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }
  if (pathname === '/') {
    if (!session) return NextResponse.redirect(new URL('/auth/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*'],
};
