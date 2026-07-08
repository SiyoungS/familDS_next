'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

export default function MyPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  const statusLabel = useMemo(() => {
    if (!user) return '알 수 없음';
    switch (user.status) {
      case 'approved':
        return '승인됨';
      case 'pending':
        return '승인 대기';
      case 'rejected':
        return '거부됨';
      case 'deleted':
        return '탈퇴함';
      default:
        return '알 수 없음';
    }
  }, [user]);

  const handleWithdrawClick = () => {
    router.push('/auth/withdraw');
  };

  const handleInquiryClick = () => {
    router.push('/inquiry');
  };

  const handleAdminClick = () => {
    router.push('/admin');
  };

  const handleHomeClick = () => {
    router.push('/');
  };

  const handleLogoutClick = async () => {
    setBusy(true);
    try {
      await logout();
      router.push('/auth/login');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10 text-slate-600">
        <p className="text-sm md:text-base">인증 상태를 확인 중입니다...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.3em] text-[#10b981]">마이페이지</p>
              <h1 className="mt-3 text-3xl md:text-4xl font-bold text-[#111827]">계정 관리</h1>
              <p className="mt-2 max-w-2xl text-sm md:text-base leading-7 text-slate-600">
                여기는 내 계정과 서비스 이용 상태를 확인하고, 회원관리 기능을 사용할 수 있는 공간입니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleHomeClick}
              className="inline-flex items-center justify-center rounded-3xl bg-slate-900 px-5 py-3 text-sm md:text-base font-semibold text-white transition hover:bg-slate-800"
            >
              돌아가기
            </button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-base md:text-lg font-semibold text-slate-900">계정 정보</h2>
              <dl className="mt-4 space-y-3 text-sm md:text-base text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <dt className="font-medium text-slate-600">이메일</dt>
                  <dd className="break-words text-slate-900">{user?.email}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="font-medium text-slate-600">이름</dt>
                  <dd className="text-slate-900">{user?.name}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="font-medium text-slate-600">역할</dt>
                  <dd className="text-slate-900">{user?.role === 'admin' ? '관리자' : '사용자'}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="font-medium text-slate-600">회원 상태</dt>
                  <dd className="text-slate-900">{statusLabel}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-base md:text-lg font-semibold text-slate-900">서비스 관리</h2>
              <div className="mt-4 space-y-3 text-sm md:text-base text-slate-700">
                <p>아래 버튼을 이용해 문의 등록, 회원 탈퇴, 로그아웃을 진행할 수 있습니다.</p>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={handleInquiryClick}
                    className="w-full rounded-3xl bg-[#10b981] px-4 py-3 text-sm md:text-base font-semibold text-white transition hover:bg-[#0f766e]"
                  >
                    문의하기로 이동
                  </button>
                  {user?.role === 'admin' ? (
                    <button
                      type="button"
                      onClick={handleAdminClick}
                      className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm md:text-base font-semibold text-slate-900 transition hover:border-slate-400"
                    >
                      관리자 페이지 이동
                    </button>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleWithdrawClick}
                      className="w-full rounded-3xl bg-red-600 px-4 py-3 text-sm md:text-base font-semibold text-white transition hover:bg-red-700"
                    >
                      회원탈퇴 진행
                    </button>
                    <button
                      type="button"
                      onClick={handleLogoutClick}
                      disabled={busy}
                      className="w-full rounded-3xl bg-slate-600 px-4 py-3 text-sm md:text-base font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? '처리 중...' : '로그아웃'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
