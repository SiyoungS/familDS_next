'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import FloatingAccountControls from '@/components/FloatingAccountControls';

export default function MyPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
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

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb] text-gray-500">
        <p className="text-sm">인증 상태를 확인 중입니다...</p>
      </div>
    );
  }

  const statusBadgeStyle =
    user?.status === 'approved'
      ? 'bg-emerald-100 text-emerald-800'
      : user?.status === 'pending'
        ? 'bg-amber-100 text-amber-800'
        : user?.status === 'rejected'
          ? 'bg-red-100 text-red-700'
          : user?.status === 'deleted'
            ? 'bg-slate-200 text-slate-700'
            : 'bg-gray-100 text-gray-700';

  return (
    <div className="min-h-screen bg-[#f9fafb] px-4 py-8 font-sans">
      <FloatingAccountControls
        position="fixed"
        collapseBelow={1024}
        items={[
          { key: 'home', label: '홈', onClick: handleHomeClick },
          { key: 'inquiry', label: '문의하기', onClick: handleInquiryClick },
          ...(user?.role === 'admin' ? [{ key: 'admin', label: '관리자', onClick: handleAdminClick }] : []),
          { key: 'logout', label: '로그아웃', emphasized: true, onClick: async () => { await logout(); router.push('/auth/login'); } },
        ]}
      />
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between pr-14 lg:pr-40">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">계정 관리</h1>
            <p className="mt-1 text-sm text-gray-500">내 계정 정보와 서비스 이용 상태</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-[#111827]">계정 정보</h2>
            <dl className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-start justify-between gap-3">
                <dt className="font-medium text-gray-500">이메일</dt>
                <dd className="break-words text-gray-900">{user?.email}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="font-medium text-gray-500">이름</dt>
                <dd className="text-gray-900">{user?.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="font-medium text-gray-500">역할</dt>
                <dd>
                  <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{user?.role === 'admin' ? '관리자' : '사용자'}</span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="font-medium text-gray-500">회원 상태</dt>
                <dd>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeStyle}`}>{statusLabel}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-[#111827]">회원 탈퇴</h2>
            <p className="mt-1 text-sm text-gray-500">서비스 이용을 중단하고 계정을 삭제할 수 있습니다.</p>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={handleWithdrawClick}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-400"
              >
                회원탈퇴 진행
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
