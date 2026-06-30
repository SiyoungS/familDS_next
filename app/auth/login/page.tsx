'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');

    try {
      await login({ email, password });
      router.push('/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했습니다.');
    }
  };

  return (
    <main onDragStart={(event) => event.preventDefault()} className="min-h-screen bg-[#f8f9fa] text-gray-900 font-sans flex items-center justify-center px-4 py-10 select-none">
      <div className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)] max-w-5xl w-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.14),_transparent_24%)] pointer-events-none" />
        <div className="relative mx-auto max-w-xl p-8 lg:p-12">
          <section className="rounded-[2rem] border border-gray-100 bg-white p-8 lg:p-10 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="mb-8 text-center">
              <p className="text-sm text-[#10b981] font-semibold uppercase tracking-[0.25em]">로그인</p>
              <h1 className="mt-5 text-3xl font-bold text-[#0f172a]">계정으로 접속하기</h1>
              <p className="mt-3 text-sm text-gray-500 leading-6">
                이메일과 비밀번호를 입력하여 심리 상담 가계도 서비스를 이용하세요.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              {errorMessage ? (
                <p className="rounded-3xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
                  {errorMessage}
                </p>
              ) : null}
              <label className="block text-sm font-medium text-gray-700">
                이메일
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@domain.com"
                  className="mt-3 w-full rounded-3xl border border-gray-200 bg-[#f8fafc] px-5 py-4 text-sm text-gray-900 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 select-text"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                비밀번호
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="mt-3 w-full rounded-3xl border border-gray-200 bg-[#f8fafc] px-5 py-4 text-sm text-gray-900 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 select-text"
                  required
                />
              </label>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-[#10b981] focus:ring-[#10b981]" />
                  <span>로그인 상태 유지</span>
                </label>
                <button type="button" className="text-[#10b981] font-semibold hover:underline">
                  비밀번호 재설정
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-3xl bg-[#10b981] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#10b981]/20 transition hover:bg-[#0d9b6d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setErrorMessage('');
                  try {
                    await loginWithGoogle();
                    router.push('/');
                  } catch (err) {
                    setErrorMessage(err instanceof Error ? err.message : '구글 로그인에 실패했습니다.');
                  }
                }}
                className="mt-3 w-full rounded-3xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                구글로 로그인
              </button>
            </form>

            <div className="mt-8 border-t border-gray-200 pt-5 text-sm text-center text-gray-500">
              아직 계정이 없으신가요?
              <div className="mt-3 flex items-center justify-center gap-4">
                <button type="button" className="font-semibold text-[#10b981] hover:underline" onClick={() => router.push('/auth/signup')}>회원가입</button>
                <button type="button" className="font-medium text-gray-500 hover:underline" onClick={() => router.push('/')}>게스트로 시작</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
