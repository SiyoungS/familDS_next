import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

// 세션 쿠키를 서버(엣지)에서 검증하여 보호 경로 접근을 차단한다.
// (JWT 만료 시 payload=null → 재로그인 유도. API 라우트는 각자 authz 수행)
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
    return null; // 만료/위조
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req);

  // /admin: 승인된 관리자만
  if (pathname.startsWith('/admin')) {
    if (!session) return NextResponse.redirect(new URL('/auth/login', req.url));
    if (session.role !== 'admin') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  // 루트(앱): 유효한 세션 필요
  if (pathname === '/') {
    if (!session) return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*'],
};
