import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth/session';
import { withdrawUserAccount } from '@/lib/db/users';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const agreed = body?.agreed === true;
  if (!agreed) {
    return NextResponse.json({ error: '탈퇴 약관에 동의해야 합니다.' }, { status: 400 });
  }

  const ok = await withdrawUserAccount(session.email);
  if (!ok) {
    return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
