'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

export default function WithdrawPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  const handleWithdraw = async () => {
    setErrorMessage('');
    if (!agreed) {
      setErrorMessage('탈퇴 약관에 동의해야 합니다.');
      return;
    }
    if (confirmText !== '탈퇴') {
      setErrorMessage('확인 문구를 정확히 입력해주세요.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '탈퇴 처리에 실패했습니다.');
      }
      await logout();
      router.replace('/auth/login');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '탈퇴 처리 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 py-10">
        <p className="text-sm text-slate-600">인증 상태를 확인 중입니다...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#ef4444]">회원탈퇴</p>
          <h1 className="mt-4 text-3xl font-bold text-[#111827]">정말 탈퇴하시겠어요?</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            탈퇴하면 계정 상태가 비활성화되고, 이후에는 서비스 이용이 제한됩니다. 현재 로그인된 계정은 <span className="font-semibold text-slate-900">{user?.email}</span> 입니다.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">탈퇴 시 처리되는 내용</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>계정이 탈퇴 처리되어 더 이상 로그인할 수 없습니다.</li>
            <li>문의 내역은 유지되지만, 계정 연결 정보는 비활성화됩니다.</li>
            <li>관리자 승인 상태와 관계없이 탈퇴 처리가 반영됩니다.</li>
          </ul>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#ef4444] focus:ring-[#ef4444]"
          />
          <span>위 내용을 모두 확인했고, 회원 탈퇴에 동의합니다.</span>
        </label>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">확인 문구 입력</label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="탈퇴"
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
          />
          <p className="mt-2 text-xs text-slate-500">확인을 위해 “탈퇴”를 정확히 입력해 주세요.</p>
        </div>

        {errorMessage ? (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={busy}
            className="flex-1 rounded-2xl bg-[#ef4444] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? '처리 중...' : '회원탈퇴 진행'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          >
            취소
          </button>
        </div>
      </div>
    </main>
  );
}
