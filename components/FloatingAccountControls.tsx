'use client';

import { useEffect, useRef, useState } from 'react';

// 리퀴드 글래스 공통 스타일
const GLASS =
  'border border-white/60 bg-gradient-to-b from-white/50 to-white/20 ring-1 ring-inset ring-white/50 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(17,24,39,0.14),inset_0_1px_0_rgba(255,255,255,0.7)]';

/**
 * 상단 우측 계정 컨트롤.
 * - 분석 엔진이 전체화면(isFullscreen)일 때: 기본은 '십자(+)' 토글로 축소.
 *   · 십자를 클릭하면 회전하며 사라지고 버튼 패널이 나타남.
 *   · 버튼 클릭 / 컴포넌트 밖 클릭 / 포커스 아웃 시: 다시 십자로 (역방향 회전) 복귀.
 * - 전체화면이 아닐 때: 버튼 패널을 항상 표시.
 */
export default function FloatingAccountControls({
  isFullscreen,
  isAdmin,
  isHistoryOpen,
  onHistory,
  onAdmin,
  onInquiry,
  onMyPage,
  onLogout,
}: {
  isFullscreen: boolean;
  isAdmin: boolean;
  isHistoryOpen: boolean;
  onHistory: () => void;
  onAdmin: () => void;
  onInquiry: () => void;
  onMyPage: () => void;
  onLogout: () => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(!isFullscreen);
  const ref = useRef<HTMLDivElement>(null);

  // 전체화면 진입 → 십자(축소), 해제 → 패널 유지
  useEffect(() => {
    setExpanded(!isFullscreen);
  }, [isFullscreen]);

  // 컴포넌트 밖 클릭 시 접기 (전체화면 + 펼쳐진 상태에서만)
  useEffect(() => {
    if (!isFullscreen || !expanded) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isFullscreen, expanded]);

  const collapse = () => {
    if (isFullscreen) setExpanded(false);
  };

  return (
    <div
      ref={ref}
      className="absolute right-6 top-6 z-50"
      onBlur={(e) => {
        // 포커스가 컴포넌트 밖으로 나가면 접기
        if (isFullscreen && ref.current && !ref.current.contains(e.relatedTarget as Node)) {
          setExpanded(false);
        }
      }}
    >
      {/* 십자(+) 토글 — 전체화면 & 접힘일 때 노출 */}
      {isFullscreen ? (
        <button
          type="button"
          aria-label="계정 메뉴 열기"
          onClick={() => setExpanded(true)}
          className={`absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-[#111827]/80 transition-all duration-300 ease-out ${GLASS} ${
            expanded ? 'pointer-events-none rotate-[135deg] scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100 hover:text-[#10b981]'
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : null}

      {/* 버튼 패널 */}
      <div
        className={`flex origin-top-right items-center gap-1.5 rounded-full p-1.5 transition-all duration-300 ease-out ${GLASS} ${
          isFullscreen && !expanded ? 'pointer-events-none scale-50 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* 사용 히스토리 열기/닫기 (아이콘) */}
        <button
          type="button"
          aria-label="사용 히스토리"
          title="사용 히스토리"
          onClick={() => onHistory()}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/50 hover:text-[#10b981] ${
            isHistoryOpen ? 'bg-white/60 text-[#10b981]' : 'text-[#111827]/80'
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v5h5" />
            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => {
            collapse();
            onInquiry();
          }}
          className="rounded-full px-5 py-2 text-sm md:text-base font-semibold text-[#111827]/90 transition hover:bg-white/50 hover:text-[#10b981]"
        >
          문의하기
        </button>
        <button
          type="button"
          onClick={() => {
            collapse();
            onMyPage();
          }}
          className="rounded-full px-5 py-2 text-sm md:text-base font-semibold text-[#111827]/90 transition hover:bg-white/50 hover:text-[#10b981]"
        >
          마이페이지
        </button>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              collapse();
              onAdmin();
            }}
            className="rounded-full px-5 py-2 text-sm md:text-base font-semibold text-[#111827]/90 transition hover:bg-white/50 hover:text-[#10b981]"
          >
            관리자
          </button>
        ) : null}
        <button
          type="button"
          onClick={async () => {
            collapse();
            await onLogout();
          }}
          className="rounded-full bg-white/35 px-5 py-2 text-sm md:text-base font-semibold text-[#111827]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:bg-white/60 hover:text-[#10b981]"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
