'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';

export default function SignupPage() {
  const router = useRouter();
  const { loginWithGoogle, isAuthenticated } = useAuth();
  const [consent, setConsent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [done, setDone] = useState<null | 'pending' | 'rejected' | 'approved'>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleGoogleSignup = async () => {
    setErrorMessage('');
    if (!consent) {
      setErrorMessage('개인정보(이메일·이름) 이용에 동의해야 가입할 수 있습니다.');
      return;
    }
    setBusy(true);
    try {
      const result = await loginWithGoogle(true);
      if (result.ok) {
        setDone('approved');
        router.push('/');
      } else {
        setDone(result.user.status === 'rejected' ? 'rejected' : 'pending');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '회원가입에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main onDragStart={(e) => e.preventDefault()} className="min-h-screen bg-[#f8f9fa] text-gray-900 font-sans flex items-center justify-center px-4 py-10 select-none">
      <div className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)] max-w-lg w-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.08),_transparent_24%)] pointer-events-none" />
        <div className="relative p-8 lg:p-12">
          <div className="mb-6">
            <span className="inline-flex rounded-full bg-[#d1fae5] px-3 py-1 text-sm md:text-base font-semibold text-[#065f46]">새 계정 생성</span>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#0f172a]">회원가입</h1>
            <p className="mt-2 text-sm md:text-base text-gray-600">Google 계정으로 가입합니다. 가입 후 <b>관리자 승인</b>이 완료되어야 서비스를 이용할 수 있습니다.</p>
          </div>

          {done === 'pending' ? (
            <div className="rounded-2xl bg-amber-50 px-5 py-6 text-sm md:text-base text-amber-800 border border-amber-100">
              <p className="font-semibold">가입 신청이 접수되었습니다.</p>
              <p className="mt-1">관리자 승인 후 로그인하여 이용할 수 있습니다.</p>
              <button type="button" className="mt-4 font-semibold text-[#10b981] hover:underline" onClick={() => router.push('/auth/login')}>로그인 화면으로</button>
            </div>
          ) : done === 'rejected' ? (
            <div className="rounded-2xl bg-red-50 px-5 py-6 text-sm md:text-base text-red-700 border border-red-100">
              접근이 거부된 계정입니다. 관리자에게 문의하세요.
            </div>
          ) : (
            <>
              {/* 수집 정보 안내 */}
              <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] px-5 py-4 text-sm md:text-base text-gray-600">
                <p className="font-semibold text-gray-800">수집하는 정보</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li><b>이메일</b> — 계정 식별 및 로그인</li>
                  <li><b>이름</b> — 서비스 내 표시</li>
                </ul>
                <p className="mt-2 text-xs text-gray-500">Google 로그인 시 위 정보를 제공받아 계정 생성에 사용합니다.</p>
              </div>

              <label className="mt-4 flex items-start gap-3 text-sm md:text-base text-gray-700">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#10b981] focus:ring-[#10b981]"
                />
                <span>개인정보(이메일·이름) 수집 및 이용에 동의합니다.</span>
              </label>

              {errorMessage ? (
                <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm md:text-base text-red-700 border border-red-100">{errorMessage}</p>
              ) : null}

              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={busy || !consent}
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-3xl border border-gray-300 bg-white px-5 py-4 text-sm md:text-base font-semibold text-gray-800 shadow-sm transition hover:border-[#10b981] hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? '처리 중...' : 'Google로 가입하기'}
              </button>

              <div className="mt-6 text-sm md:text-base text-center text-gray-500">
                이미 계정이 있으신가요?{' '}
                <button type="button" className="font-semibold text-[#10b981] hover:underline" onClick={() => router.push('/auth/login')}>로그인</button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
