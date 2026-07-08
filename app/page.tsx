'use client';

import AnalysisEnginePage from '@/components/AnalysisEnginePage';
import FloatingAccountControls from '@/components/FloatingAccountControls';
import HistoryPanel from '@/components/HistoryPanel';
import RelationAnalysisPage from '@/components/RelationAnalysisPage';
import { BWGenogramData } from '@/types/bowengenogram.types';
import { HistoryItem } from '@/types/history';
import { processGenogramData } from '@/lib/genograms/bowen/process';
import { JSX, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './providers/AuthProvider';
import { useHistory } from './providers/HistoryProvider';
import GenogramCanvas from './(genograms)/GenogramCanvas';
import RelationAnalysisCenterCard, { cardVariantsInit, cardVariants } from '@/components/RelationAnalysisCenterCard';
import { Variants } from 'framer-motion';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading, logout } = useAuth();
  const { addHistory } = useHistory();
  const [cardVariant, setCardVariant] = useState<Variants>(cardVariantsInit);
  const [counselTarget, setCounselTarget] = useState('');
  const [counselText, setCounselText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
      .then(res => res.json())
      .then((result) => {
        // { raw: 가공 전, processed: 표시용 }
        setData(result.processed ?? result);
        if (result?.raw) {
          addHistory({ counselTarget, counselText, raw: result.raw });
        }
      })
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
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  // 히스토리 항목 불러오기: 저장된 raw(가공 전)에 동일 후처리를 적용해 표시
  const handleLoadHistory = (item: HistoryItem) => {
    setCounselTarget(item.counselTarget);
    setCounselText(item.counselText);
    setData(processGenogramData(item.raw));
    setAnalysisStep('results');
    setIsHistoryOpen(false);
  };

  const handleReset = () => {
    setCounselText('');
    setCounselTarget('');
    setAnalysisStep('input');
    setCardVariant(cardVariants);
  };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ffffff]">
        <p className="text-sm md:text-base text-gray-600">인증 상태를 확인 중입니다...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative w-full h-screen bg-[#ffffff] overflow-hidden font-sans select-none flex">
      <FloatingAccountControls
        isFullscreen={isMenuOpen}
        isAdmin={isAdmin}
        isHistoryOpen={isHistoryOpen}
        onHistory={() => setIsHistoryOpen((v) => !v)}
        onAdmin={() => router.push('/admin')}
        onInquiry={() => router.push('/inquiry')}
        onMyPage={() => router.push('/mypage')}
        onLogout={async () => {
          await logout();
          router.push('/auth/login');
        }}
      />
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

      {/* 히스토리 패널: 분석 엔진 '다음'에 배치해 항상 위에 표시 */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        setIsOpen={setIsHistoryOpen}
        onLoad={handleLoadHistory}
      />

      {Object.keys(toastMessageList).length > 0 && (
        Object.values(toastMessageList)[0]
      )}
    </div>
  )
}
