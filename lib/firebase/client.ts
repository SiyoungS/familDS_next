'use client';

// 클라이언트용 Firebase 초기화 + Google 로그인.
// 설정값은 모두 공개(NEXT_PUBLIC_*) 값이다.

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/**
 * Google 팝업 로그인 후 Firebase ID 토큰을 반환한다.
 * (이 토큰을 서버 /api/auth/google 로 보내 검증)
 */
export async function signInWithGoogle(): Promise<{
  idToken: string;
  email: string;
  name: string;
  photoURL?: string;
}> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return {
    idToken,
    email: result.user.email || '',
    name: result.user.displayName || (result.user.email || '').split('@')[0],
    photoURL: result.user.photoURL || undefined,
  };
}

export async function firebaseSignOut(): Promise<void> {
  await signOut(getFirebaseAuth());
}
