'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithGoogle, isAuthenticated, loading } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setNotice('');
    setBusy(true);
    try {
      const result = await loginWithGoogle();
      if (result.ok) {
        router.push('/');
      } else if (result.user.status === 'pending') {
        setNotice('가입이 접수되었습니다. 관리자 승인 후 이용할 수 있습니다.');
      } else if (result.user.status === 'rejected') {
        setErrorMessage('접근이 거부된 계정입니다. 관리자에게 문의하세요.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main onDragStart={(e) => e.preventDefault()} className="min-h-screen bg-[#f8f9fa] text-gray-900 font-sans flex items-center justify-center px-4 py-10 select-none">
      <div className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)] max-w-md w-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.14),_transparent_24%)] pointer-events-none" />
        <div className="relative p-8 lg:p-12">
          <div className="mb-8 text-center">
            <p className="text-sm md:text-base text-[#10b981] font-semibold uppercase tracking-[0.25em]">로그인</p>
            <h1 className="mt-5 text-3xl font-bold text-[#0f172a]">계정으로 접속하기</h1>
            <p className="mt-3 text-sm md:text-base text-gray-500 leading-6">
              Google 계정으로 심리 상담 가계도 서비스를 이용하세요.
            </p>
          </div>

          {errorMessage ? (
            <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm md:text-base text-red-700 border border-red-100">{errorMessage}</p>
          ) : null}
          {notice ? (
            <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm md:text-base text-amber-800 border border-amber-100">{notice}</p>
          ) : null}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={busy || loading}
            className="flex w-full items-center justify-center gap-3 rounded-3xl border border-gray-300 bg-white px-5 py-4 text-sm md:text-base font-semibold text-gray-800 shadow-sm transition hover:border-[#10b981] hover:shadow disabled:cursor-not-allowed disabled:opacity-70"
          >
            <GoogleIcon />
            {busy ? '로그인 중...' : 'Google로 로그인'}
          </button>

          <div className="mt-8 border-t border-gray-200 pt-5 text-sm md:text-base text-center text-gray-500">
            아직 계정이 없으신가요?
            <div className="mt-3">
              <button type="button" className="font-semibold text-[#10b981] hover:underline" onClick={() => router.push('/auth/signup')}>회원가입</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
