'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BWGenogramData } from '@/types/bowengenogram.types';
import GenogramCanvas from './GenogramCanvas'; // 실제 그림을 그릴 컴포넌트

export default function GenogramModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const show = searchParams.get('showGenogram') === 'true';
  const counselTarget = searchParams.get('target') || '';
  const counselText = searchParams.get('text') || '';
  const [data, setData] = useState<BWGenogramData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (show) {
      setIsLoading(true);
      if (data!=null) {
        setData(null);
      }
      console.log('Counsel Target for Genogram:', counselTarget); // 디버깅용 로그
      console.log('Counsel Text for Genogram:', counselText); // 디버깅용 로그
      const flag = false;
      if (flag) {
        console.log('Fetching genogram data from /api/generate with payload:', { counselText, counselTarget }); // 디버깅용 로그
        fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counselText: counselText, counselTarget: counselTarget })
        })
        .then(res => {
          if (!res.ok) throw new Error('데이터 생성 실패');
          console.log('Raw response from /api/generate:', res); // 디버깅용 로그
          return res.json();
        })
        .then(setData)
        .catch(err => {
          console.error(err);
          alert('가계도 생성에 실패했습니다. 다시 시도해주세요.');
          
          router.back();
        })
        .finally(() => setIsLoading(false));
      } else {
        console.log('Fetching genogram data from /api/mock-genogram'); // 디버깅용 로그
        fetch('/api/mock-genogram')
          .then(res => res.json())
          .then(setData)
          .finally(() => setIsLoading(false));
      }
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[90vw] h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">심리 상담 가계도</h2>
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-full transition"
          >
            ✕
          </button>
        </div>

        {/* 캔버스 영역 */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          {data ? (
            <GenogramCanvas data={data} />
          ) : (
            <div className="flex h-full items-center justify-center">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}