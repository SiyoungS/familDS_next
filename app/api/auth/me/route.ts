import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth/session';
import { findUserByEmail, toPublicUser } from '@/lib/db/users';

export const runtime = 'nodejs';

// GET /api/auth/me — 현재 세션의 사용자.
// 세션이 없거나 만료(비관리자 1시간) 시 401 → 재로그인 필요.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // DB에서 최신 상태 확인 (관리자가 승인 취소/권한 변경했을 수 있음)
  const user = await findUserByEmail(session.email);
  if (!user || user.status !== 'approved') {
    await clearSessionCookie();
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user: toPublicUser(user) });
}
