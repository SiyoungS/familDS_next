import { NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/auth/verify-firebase';
import { setSessionCookie } from '@/lib/auth/session';
import { upsertUserOnLogin, toPublicUser } from '@/lib/db/users';

export const runtime = 'nodejs';

// POST /api/auth/google
// body: { idToken: string, consent?: boolean }
// Google ID 토큰 검증 → 사용자 upsert → 승인된 경우에만 세션 쿠키 발급
export async function POST(request: Request) {
  try {
    const { idToken, consent } = await request.json();
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'idToken이 필요합니다.' }, { status: 400 });
    }

    const identity = await verifyFirebaseIdToken(idToken);
    if (!identity.emailVerified) {
      return NextResponse.json({ error: '이메일 인증이 완료되지 않은 계정입니다.' }, { status: 403 });
    }

    const user = await upsertUserOnLogin({
      email: identity.email,
      name: identity.name,
      photoURL: identity.picture,
      consent: consent === true,
    });

    if (user.status === 'approved') {
      await setSessionCookie({
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      });
      return NextResponse.json({ authenticated: true, user: toPublicUser(user) });
    }

    // pending / rejected → 세션 미발급
    return NextResponse.json({ authenticated: false, user: toPublicUser(user) });
  } catch (error) {
    console.error('auth/google error:', error);
    return NextResponse.json({ error: '로그인 검증에 실패했습니다.' }, { status: 401 });
  }
}
