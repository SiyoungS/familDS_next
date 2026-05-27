'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleSignup = (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    // TODO: 실제 가입 로직 (API 호출) 추가
    router.push('/auth/login');
  };

  return (
    <main className="min-h-screen bg-[#f8f9fa] text-gray-900 font-sans flex items-center justify-center px-4 py-10">
      <div className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)] max-w-3xl w-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.08),_transparent_24%)] pointer-events-none" />
        <div className="relative p-8 lg:p-12">
          <div className="mb-6">
            <span className="inline-flex rounded-full bg-[#d1fae5] px-3 py-1 text-sm font-semibold text-[#065f46]">
              새 계정 생성
            </span>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#0f172a]">회원가입</h1>
            <p className="mt-2 text-sm text-gray-600">기본 정보를 입력해 계정을 생성하세요. 테스트 환경에서는 즉시 로그인 화면으로 이동합니다.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSignup}>
            <label className="block text-sm font-medium text-gray-700">
              이름
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="mt-3 w-full rounded-3xl border border-gray-200 bg-[#f8fafc] px-5 py-3 text-sm text-gray-900 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              이메일
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="mt-3 w-full rounded-3xl border border-gray-200 bg-[#f8fafc] px-5 py-3 text-sm text-gray-900 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-3 w-full rounded-3xl border border-gray-200 bg-[#f8fafc] px-5 py-3 text-sm text-gray-900 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              비밀번호 확인
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="mt-3 w-full rounded-3xl border border-gray-200 bg-[#f8fafc] px-5 py-3 text-sm text-gray-900 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20"
                required
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-3xl bg-[#10b981] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#10b981]/20 transition hover:bg-[#0d9b6d]"
            >
              계정 생성
            </button>
          </form>

          <div className="mt-6 text-sm text-center text-gray-500">
            이미 계정이 있으신가요?{' '}
            <button type="button" className="font-semibold text-[#10b981] hover:underline" onClick={() => router.push('/auth/login')}>로그인</button>
          </div>
        </div>
      </div>
    </main>
  );
}
