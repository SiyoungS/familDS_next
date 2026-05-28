'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AuthUser = {
  email: string;
  name: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  signup: (payload: { name: string; email: string; password: string }) => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);
const STORAGE_KEY = 'familDS-auth-user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
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
    await new Promise((resolve) => setTimeout(resolve, 200));

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      setLoading(false);
      throw new Error('이메일과 비밀번호를 모두 입력해주세요.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setLoading(false);
      throw new Error('올바른 이메일 형식이 아닙니다.');
    }

    const nextUser = {
      email: normalizedEmail,
      name: '사용자',
    };

    setUser(nextUser);
    persistUser(nextUser);
    setLoading(false);
  };

  const logout = () => {
    setUser(null);
    persistUser(null);
  };

  const signup = async ({ name, email, password }: { name: string; email: string; password: string }) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const normalizedEmail = email.trim().toLowerCase();
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

    setLoading(false);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
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
