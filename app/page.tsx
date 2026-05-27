'use client';

import AnalysisEnginePage from '@/components/AnalysisEnginePage';
import RelationAnalysisPage from '@/components/RelationAnalysisPage';
import { BWGenogramData } from '@/types/bowengenogram.types';
import { JSX, useState } from 'react';
import { useRouter } from 'next/navigation';
import GenogramCanvas from './(genograms)/GenogramCanvas';
import RelationAnalysisCenterCard, { cardVariantsInit, cardVariants } from '@/components/RelationAnalysisCenterCard';
import { Variants } from 'framer-motion';

export default function Home() {
  const router = useRouter();
  const [cardVariant, setCardVariant] = useState<Variants>(cardVariantsInit);
  const [counselTarget, setCounselTarget] = useState(''); 
  const [counselText, setCounselText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<'input' | 'analyzing' | 'results' >('input');

  const [data, setData] = useState<BWGenogramData | null>(null);
  
  const [toastMessageList, setToastMessageList] = useState<Record<string, JSX.Element>>({});
  const toastMessageElement = (message:string) => {
    return (
      <div className="fixed bottom-5 left-5 z-50 bg-gray-900/95 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2.5 animate-bounce-horizontal border border-white/10 backdrop-blur-md">
        <span className="text-[#10b981] font-bold">💡 시스템 알림:</span>
        <span className="text-xs font-medium">{message}</span>
      </div>
    )
  }
  const addToastMessage = (msg:string) => {
    const uniqueKey = `${msg}-${Date.now()}`;
    setToastMessageList({ 
      [uniqueKey]: toastMessageElement(msg) 
    });
    setTimeout(() => {
      setToastMessageList(prev => {
        const newToastMessages = { ...prev };
        delete newToastMessages[uniqueKey];
        return newToastMessages;
      });
    }, 3000);
  }

  const handleAnalyze = (resultType:'genogram' | 'ecomap' | 'report') => {
    if (resultType !== 'genogram') {
      addToastMessage('현재는 가계도 분석만 지원됩니다. 곧 다른 분석 기능도 제공할 예정이니 조금만 기다려주세요!');
      return;
    }
    if (!counselTarget.trim()) {
      addToastMessage('상담 대상을 입력해주세요.');
      return;
    }
    if (!counselText.trim()) {
      addToastMessage('상담 내용을 입력해주세요.');
      return;
    }
    const useLocalJsonData = false;
    setAnalysisStep('analyzing');
    if (!useLocalJsonData) {
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
        addToastMessage('가계도 생성에 실패했습니다. 다시 시도해주세요.');
      })
      .finally(() => setAnalysisStep('results'));
    } else {
      fetch('/api/mock-genogram')
        .then(res => res.json())
        .then(setData)
        .finally(() => setAnalysisStep('results'));
    }
  };
  const handleReset = () => {
    setCounselText('');
    setCounselTarget('');
    setAnalysisStep('input');
    setCardVariant(cardVariants);
  };
  return (
    <div className="relative w-full h-screen bg-[#ffffff] overflow-hidden font-sans select-none flex">
      <div className="absolute right-6 top-6 z-50">
        <button
          type="button"
          onClick={() => router.push('/auth/login')}
          className="rounded-2xl border border-[#d1d5db] bg-white px-5 py-2 text-sm font-semibold text-[#111827] shadow-sm transition hover:border-[#10b981] hover:text-[#10b981]"
        >
          로그인
        </button>
      </div>
      <RelationAnalysisPage isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} 
      children={
        (analysisStep === 'results' && data) ? (
          <GenogramCanvas data={data} />
        ) : <RelationAnalysisCenterCard 
        isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} 
        variants={cardVariant}
        />
      }
      />
      <AnalysisEnginePage 
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        // IP 이름
        counselTarget={counselTarget}
        setCounselTarget={setCounselTarget}
        // 상담 내용
        counselText={counselText}
        setCounselText={setCounselText}

        analysisStep={analysisStep}
        setAnalysisStep={setAnalysisStep}
        handleReset={handleReset}
        handleAnalyze={handleAnalyze}
      />
      
      {Object.keys(toastMessageList).length > 0 && (
        Object.values(toastMessageList)[0]
      )}
    </div>
  )
}
