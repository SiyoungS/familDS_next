// 자체 세션 JWT(httpOnly 쿠키) 발급/검증.
// 일반 유저는 1시간, 관리자는 더 길게 만료 → 만료 시 재로그인 필요.

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import {
  getJwtSecret,
  SESSION_COOKIE,
  USER_TTL_HOURS,
  ADMIN_TTL_HOURS,
} from './config';
import type { SessionPayload } from '@/types/auth';

export async function createSessionToken(payload: SessionPayload): Promise<{ token: string; maxAgeSec: number }> {
  const hours = payload.role === 'admin' ? ADMIN_TTL_HOURS : USER_TTL_HOURS;
  const maxAgeSec = Math.round(hours * 3600);
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(getJwtSecret());
  return { token, maxAgeSec };
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.email || !payload.role) return null;
    return {
      email: String(payload.email),
      name: String(payload.name || ''),
      role: payload.role as SessionPayload['role'],
      status: payload.status as SessionPayload['status'],
    };
  } catch {
    // 만료/위조 등
    return null;
  }
}

// 응답 쿠키에 세션 설정
export async function setSessionCookie(payload: SessionPayload) {
  const { token, maxAgeSec } = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// 현재 요청의 세션 읽기(없거나 만료면 null)
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
