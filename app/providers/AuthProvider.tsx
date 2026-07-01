'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { signInWithGoogle, firebaseSignOut } from '@/lib/firebase/client';
import type { PublicUser } from '@/types/auth';

type LoginResult =
  | { ok: true; user: PublicUser }
  | { ok: false; user: PublicUser }; // 승인 대기/거부 (세션 미발급)

type AuthState = {
  user: PublicUser | null;          // 승인되어 세션이 있는 사용자
  loading: boolean;
  isAuthenticated: boolean;         // 승인 + 세션
  isAdmin: boolean;
  loginWithGoogle: (consent?: boolean) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 현재 세션 확인 (없거나 만료면 null)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user as PublicUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const loginWithGoogle = useCallback(async (consent?: boolean): Promise<LoginResult> => {
    setLoading(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, consent: consent === true }),
      });
      // 세션은 httpOnly 쿠키로만 관리 → firebase 세션은 정리(매 로그인 재인증)
      await firebaseSignOut().catch(() => {});

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '로그인에 실패했습니다.');
      }

      if (data.authenticated) {
        setUser(data.user as PublicUser);
        return { ok: true, user: data.user as PublicUser };
      }
      // 승인 대기 또는 거부
      setUser(null);
      return { ok: false, user: data.user as PublicUser };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await firebaseSignOut().catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user && user.status === 'approved'),
      isAdmin: user?.role === 'admin',
      loginWithGoogle,
      logout,
      refresh,
    }),
    [user, loading, loginWithGoogle, logout, refresh]
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
