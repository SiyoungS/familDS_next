'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (event: FormEvent) => {
    event.preventDefault();
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-[#f8f9fa] text-gray-900 font-sans flex items-center justify-center px-4 py-10">
      <div className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)] max-w-5xl w-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.14),_transparent_24%)] pointer-events-none" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] p-8 lg:p-12">
          <section className="flex flex-col justify-between rounded-[1.75rem] border border-gray-100 bg-[#f9fafc] p-8 lg:p-10 shadow-sm">
            <div>
              <span className="inline-flex rounded-full bg-[#d1fae5] px-3 py-1 text-sm font-semibold text-[#065f46]">
                좋음 톤의 상담 AI
              </span>
              <h1 className="mt-8 text-3xl font-bold tracking-tight text-[#0f172a]">
                심리 상담 가계도에 로그인
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-gray-600">
                상담 데이터를 안전하게 관리하고, AI 기반 가족 분석을 바로 시작하세요. 현재 앱의 심플하고 전문적인 디자인과 어울리는 로그인 화면입니다.
              </p>
            </div>

            <div className="mt-10 space-y-4 text-sm text-gray-600">
              <div className="rounded-3xl bg-white p-4 border border-gray-100 shadow-sm">
                <p className="font-semibold text-gray-900">주요 기능</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li>• 상담 텍스트 기반 가계도 자동 생성</li>
                  <li>• 데이터 입력/분석 결과 저장</li>
                  <li>• 직관적인 레이아웃과 매끄러운 인터랙션</li>
                </ul>
              </div>
              <div className="rounded-3xl bg-white p-4 border border-gray-100 shadow-sm">
                <p className="font-semibold text-gray-900">이용 팁</p>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  이메일과 비밀번호만 입력하면 됩니다. 테스트용으로는 곧 추가될 실제 인증 기능을 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-gray-100 bg-white p-8 lg:p-10 shadow-sm">
            <div className="mb-8">
              <p className="text-sm text-[#10b981] font-bold uppercase tracking-[0.25em]">로그인</p>
              <h2 className="mt-4 text-2xl font-bold text-[#0f172a]">계정으로 접속하기</h2>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <label className="block text-sm font-medium text-gray-700">
                이메일
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@domain.com"
                  className="mt-3 w-full rounded-3xl border border-gray-200 bg-[#f8fafc] px-5 py-4 text-sm text-gray-900 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20"
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
                  className="mt-3 w-full rounded-3xl border border-gray-200 bg-[#f8fafc] px-5 py-4 text-sm text-gray-900 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20"
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
                className="w-full rounded-3xl bg-[#10b981] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#10b981]/20 transition hover:bg-[#0d9b6d]"
              >
                로그인
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
