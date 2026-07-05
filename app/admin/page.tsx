'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

type AdminUser = {
  email: string;
  name: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string | null;
  approvedAt: string | null;
};

const STATUS_LABEL: Record<AdminUser['status'], string> = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '거부됨',
  deleted: '탈퇴함',
};
const STATUS_STYLE: Record<AdminUser['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  deleted: 'bg-slate-200 text-slate-700',
};

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, isAdmin, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  // 접근 가드: 로그인 안 됨 → 로그인, 관리자 아님 → 홈
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login');
    } else if (!isAdmin) {
      router.replace('/');
    }
  }, [loading, user, isAdmin, router]);

  const load = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!res.ok) throw new Error('목록을 불러오지 못했습니다.');
      const data = await res.json();
      setUsers(data.users as AdminUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const changeStatus = async (email: string, status: AdminUser['status']) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '변경에 실패했습니다.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  };

  const admins = useMemo(() => users.filter((u) => u.role === 'admin'), [users]);
  const normalUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users]);
  const pendingCount = useMemo(() => normalUsers.filter((u) => u.status === 'pending').length, [normalUsers]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb]">
        <p className="text-sm text-gray-500">관리자 권한 확인 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] px-4 py-8 font-sans">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">사용자 관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              관리자 {admins.length}명 · 일반 사용자 {normalUsers.length}명 · 승인 대기 {pendingCount}명
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#10b981]">새로고침</button>
            <button onClick={() => router.push('/')} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#10b981]">홈</button>
            <button onClick={async () => { await logout(); router.push('/auth/login'); }} className="rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black">로그아웃</button>
          </div>
        </header>

        {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

        {/* 관리자 */}
        <Section title="관리자" subtitle="DB에서 role=admin 으로 지정된 계정">
          <UserTable users={admins} onChange={changeStatus} selfEmail={user?.email} isAdminTable />
        </Section>

        {/* 일반 사용자 */}
        <Section title="일반 사용자" subtitle="승인해야 서비스 이용 가능">
          {fetching ? (
            <p className="px-4 py-6 text-sm text-gray-400">불러오는 중...</p>
          ) : (
            <UserTable users={normalUsers} onChange={changeStatus} selfEmail={user?.email} />
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-lg font-bold text-[#111827]">{title}</h2>
        <span className="text-xs text-gray-400">{subtitle}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">{children}</div>
    </section>
  );
}

function fmt(d: string | null) {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function UserTable({
  users,
  onChange,
  selfEmail,
  isAdminTable = false,
}: {
  users: AdminUser[];
  onChange: (email: string, status: AdminUser['status']) => void;
  selfEmail?: string;
  isAdminTable?: boolean;
}) {
  if (users.length === 0) {
    return <p className="px-4 py-6 text-sm text-gray-400">해당 사용자가 없습니다.</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
        <tr>
          <th className="px-4 py-3">사용자</th>
          <th className="px-4 py-3">상태</th>
          <th className="px-4 py-3">가입일</th>
          <th className="px-4 py-3">최근 로그인</th>
          {!isAdminTable ? <th className="px-4 py-3 text-right">승인 관리</th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {users.map((u) => (
          <tr key={u.email}>
            <td className="px-4 py-3">
              <div className="font-semibold text-gray-900">{u.name}{u.email === selfEmail ? ' (나)' : ''}</div>
              <div className="text-xs text-gray-500">{u.email}</div>
            </td>
            <td className="px-4 py-3">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[u.status]}`}>{STATUS_LABEL[u.status]}</span>
            </td>
            <td className="px-4 py-3 text-gray-500">{fmt(u.createdAt)}</td>
            <td className="px-4 py-3 text-gray-500">{fmt(u.lastLoginAt)}</td>
            {!isAdminTable ? (
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {u.status !== 'approved' ? (
                    <button onClick={() => onChange(u.email, 'approved')} className="rounded-lg bg-[#10b981] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d9b6d]">승인</button>
                  ) : (
                    <button onClick={() => onChange(u.email, 'pending')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-amber-400">승인 취소</button>
                  )}
                  {u.status !== 'rejected' ? (
                    <button onClick={() => onChange(u.email, 'rejected')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:border-red-400">거부</button>
                  ) : null}
                </div>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
