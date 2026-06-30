'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

type AuthUser = {
  uid: string;
  email: string;
  name: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signup: (payload: { name: string; email: string; password: string }) => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);
const STORAGE_KEY = 'familDS-auth-user';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getDisplayName = (email: string | null | undefined, fallback = '사용자') => {
  if (!email) return fallback;

  const localPart = email.split('@')[0];
  return localPart || fallback;
};

const getFriendlyErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: string }).code;
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return '이메일 또는 비밀번호가 올바르지 않습니다.';
      case 'auth/email-already-in-use':
        return '이미 사용 중인 이메일입니다.';
      case 'auth/weak-password':
        return '비밀번호는 최소 6자리 이상이어야 합니다.';
      case 'auth/network-request-failed':
        return '네트워크 연결을 확인해주세요.';
      case 'auth/too-many-requests':
        return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
      default:
        return '인증 처리 중 문제가 발생했습니다.';
    }
  }

  return error instanceof Error ? error.message : '인증 처리 중 문제가 발생했습니다.';
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const nextUser: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          name: firebaseUser.displayName || getDisplayName(firebaseUser.email),
        };

        setUser(nextUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const persistUser = (nextUser: AuthUser | null) => {
    if (nextUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const login = async ({ email, password }: { email: string; password: string }) => {
    setLoading(true);

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password.trim()) {
      setLoading(false);
      throw new Error('이메일과 비밀번호를 모두 입력해주세요.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setLoading(false);
      throw new Error('올바른 이메일 형식이 아닙니다.');
    }

    if (!auth) {
      setLoading(false);
      throw new Error('Firebase 인증이 아직 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const firebaseUser = credential.user;
      const nextUser: AuthUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? normalizedEmail,
        name: firebaseUser.displayName || getDisplayName(firebaseUser.email),
      };

      setUser(nextUser);
      persistUser(nextUser);
      await saveUserToMongo({ uid: nextUser.uid, email: nextUser.email, name: nextUser.name });
    } catch (error) {
      throw new Error(getFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const saveUserToMongo = async (payload: { uid: string; email: string; name: string }) => {
    try {
      await fetch('/api/users/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to persist user to MongoDB:', err);
    }
  };

  const loginWithGoogle = async () => {
    if (!auth) throw new Error('Firebase 인증이 설정되지 않았습니다.');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const nextUser: AuthUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        name: firebaseUser.displayName || getDisplayName(firebaseUser.email),
      };

      setUser(nextUser);
      persistUser(nextUser);

      await saveUserToMongo({ uid: nextUser.uid, email: nextUser.email, name: nextUser.name });
    } catch (err) {
      throw new Error(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) return;

    setLoading(true);
    await signOut(auth);
    setUser(null);
    persistUser(null);
    setLoading(false);
  };

  const signup = async ({ name, email, password }: { name: string; email: string; password: string }) => {
    setLoading(true);

    const normalizedEmail = normalizeEmail(email);
    if (!name.trim() || !normalizedEmail || !password.trim()) {
      setLoading(false);
      throw new Error('모든 항목을 입력해주세요.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setLoading(false);
      throw new Error('올바른 이메일 형식이 아닙니다.');
    }

    if (password.length < 6) {
      setLoading(false);
      throw new Error('비밀번호는 최소 6자리여야 합니다.');
    }

    if (!auth) {
      setLoading(false);
      throw new Error('Firebase 인증이 아직 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      if (name.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() });
      }

      const nextUser: AuthUser = {
        uid: credential.user.uid,
        email: credential.user.email ?? normalizedEmail,
        name: name.trim() || getDisplayName(credential.user.email),
      };

      setUser(nextUser);
      persistUser(nextUser);
      await saveUserToMongo({ uid: nextUser.uid, email: nextUser.email, name: nextUser.name });
    } catch (error) {
      throw new Error(getFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      loginWithGoogle,
      logout,
      signup,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  }
  return context;
}
