// Firebase(Google) ID 토큰을 서버에서 검증한다.
// service account 없이, 구글의 공개키(JWKS)로 직접 검증한다.
// (service account를 .env에 넣게 되면 firebase-admin으로 교체 가능)

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { FIREBASE_PROJECT_ID } from './config';

// 구글 시큐어토큰 서비스의 JWKS 엔드포인트
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface FirebaseIdentity {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error('.env에 NEXT_PUBLIC_FIREBASE_PROJECT_ID가 없습니다.');
  }

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
    algorithms: ['RS256'],
  });

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!email) {
    throw new Error('토큰에 이메일 정보가 없습니다.');
  }

  return {
    uid: String(payload.sub || payload.user_id || ''),
    email,
    name: typeof payload.name === 'string' ? payload.name : email.split('@')[0],
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    emailVerified: payload.email_verified === true,
  };
}
