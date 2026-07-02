// 인증/DB 관련 환경설정을 한 곳에서 읽는다.

export const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';

// DB명: MONGODB_DB_NAME 우선, 없으면 기존 MONGODB_PROJECT_NAME 사용(하위호환)
export const DB_NAME = process.env.MONGODB_DB_NAME || process.env.MONGODB_PROJECT_NAME || '';
export const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION || 'users';
export const HISTORY_COLLECTION = process.env.MONGODB_HISTORY_COLLECTION || 'histories';

// 세션 쿠키 이름
export const SESSION_COOKIE = 'familyds_session';

// 세션 만료(시간). 관리자는 길게, 일반 유저는 1시간마다 재로그인.
export const USER_TTL_HOURS = Number(process.env.JWT_USER_TTL_HOURS || 1);
export const ADMIN_TTL_HOURS = Number(process.env.JWT_ADMIN_TTL_HOURS || 12);

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('.env에 JWT_SECRET을 설정해주세요.');
  }
  return new TextEncoder().encode(secret);
}
