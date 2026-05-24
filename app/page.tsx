'use client';

import RelationAnalysisPage from '@/components/MainPageScreen';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [counselTarget, setCounselTarget] = useState(''); 
  const [counselText, setCounselText] = useState('');

  const handleOpenGenogram = () => {
    if (!counselTarget.trim()) {
      alert('상담 대상을 입력해주세요.');
      return;
    }
    if (!counselText.trim()) {
      alert('상담 내용을 입력해주세요.');
      return;
    }
    const encodedText = encodeURIComponent(counselText);
    const encodedTarget = encodeURIComponent(counselTarget);
    router.push(`?showGenogram=true&target=${encodedTarget}&text=${encodedText}`);
  };
  return (
    <>
    <RelationAnalysisPage />
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black min-h-screen">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black sm:items-start border-x border-zinc-100 dark:border-zinc-800">
        
        <div className="space-y-4 w-full text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            심리 상담 시스템
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            아래 버튼을 클릭하여 내담자의 가족 관계도(Genogram)를 확인하세요.
          </p>
          <div className='flex flex-row w-full '>
            <input 
              type="text" 
              value={counselTarget}
              
              onChange={(e) => setCounselTarget(e.target.value)}
              placeholder={`띄어쓰기 없이 이름을 입력해주세요. 예: 홍길동`}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 outline-none" 
            />
          </div>
          <div className='flex flex-row w-full '>
            <input 
              type="text" 
              value={counselText}
              onChange={(e) => setCounselText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenGenogram()} // 엔터키 지원
              placeholder="예: 30대 여성, 남편과 아들이 있고 현재 둘째 임신 중..." 
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 outline-none" 
            />
          </div>
          
          <div className="pt-4">
            <button
              onClick={handleOpenGenogram}
              className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all active:scale-95"
            >
              가계도 생성 및 확인
            </button>
          </div>
        </div>

      </main>
    </div>
    </>
  )
  // return (
    
  // );
}
