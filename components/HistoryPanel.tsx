'use client';

import { useEffect, useState } from 'react';
import { useHistory } from '@/app/providers/HistoryProvider';
import type { HistoryItem } from '@/types/history';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

export default function HistoryPanel({
  isOpen,
  setIsOpen,
  onLoad,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLoad: (item: HistoryItem) => void;
}) {
  const { items, loading, saveToDb, deleteFromDb, removeItem, syncFromDb } = useHistory();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // 패널 열릴 때 본인 DB 저장 항목을 캐시로 병합
  useEffect(() => {
    if (isOpen) syncFromDb();
  }, [isOpen, syncFromDb]);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {/* 딤 오버레이: 열리면 나머지를 어둡게, 바깥 클릭 시 닫힘 */}
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        className={`absolute top-0 right-0 h-full bg-white border-l border-gray-100 shadow-[20px_0_60px_rgba(0,0,0,0.2)] transition-all duration-300 ease-in-out z-40 flex
          ${isOpen ? 'w-full lg:w-[520px] translate-x-0' : 'w-0 translate-x-full lg:translate-x-0 lg:w-0'}
        `}
      >
        {/* 은은한 배경 그라데이션 (리퀴드 글라스 아이템 강조용) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(56,189,248,0.12),_transparent_42%)]" />

        <div className="relative w-full h-full flex flex-col p-6 lg:p-10 overflow-y-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 mb-2">
            Usage History
          </span>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 leading-tight">사용 히스토리</h1>
          <p className="text-lg lg:text-xl font-extrabold text-[#10b981] mt-0.5">세션 기록</p>
          <p className="mt-2 text-xs text-gray-400">이번 세션의 분석 기록입니다. 저장하면 본인 계정에만 보관됩니다.</p>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-16">
            <span className="text-3xl mb-2">🗂️</span>
            <p className="text-sm">아직 기록이 없습니다.</p>
            <p className="text-xs mt-1">분석을 실행하면 이곳에 기록됩니다.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const { date, time } = formatDateTime(item.createdAt);
              const busy = busyId === item.id;
              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-white/70 bg-gradient-to-b from-white/70 to-white/30 p-4 ring-1 ring-inset ring-white/60 shadow-[0_8px_24px_rgba(17,24,39,0.10),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl backdrop-saturate-150"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 truncate">{item.counselTarget || '(이름 없음)'}</span>
                        {item.saved ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">저장됨</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-400">{date} · {time}</div>
                    </div>
                    <button
                      onClick={() => onLoad(item)}
                      className="shrink-0 rounded-lg bg-[#10b981] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0da673] transition"
                    >
                      불러오기
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!item.saved ? (
                      <button
                        disabled={busy}
                        onClick={() => run(item.id, () => saveToDb(item.id))}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#10b981] hover:text-[#10b981] disabled:opacity-50"
                      >
                        저장
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => run(item.id, () => deleteFromDb(item.id))}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-600 hover:border-amber-400 disabled:opacity-50"
                        title="DB에서만 삭제 (목록에는 남음)"
                      >
                        DB에서 삭제
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => run(item.id, () => removeItem(item.id))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:border-red-400 disabled:opacity-50"
                      title="DB와 목록에서 모두 삭제"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </div>
    </>
  );
}
