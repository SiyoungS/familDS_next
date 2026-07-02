'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BWGenogramData } from '@/types/bowengenogram.types';
import type { HistoryItem, SavedHistory } from '@/types/history';

const STORAGE_KEY = 'familyds-history-cache';

type HistoryState = {
  items: HistoryItem[];
  loading: boolean;
  addHistory: (data: { counselTarget: string; counselText: string; raw: BWGenogramData }) => void;
  saveToDb: (id: string) => Promise<void>;
  deleteFromDb: (id: string) => Promise<void>; // DB에서만 삭제 (캐시 유지)
  removeItem: (id: string) => Promise<void>;    // DB + 캐시 모두 삭제
  syncFromDb: () => Promise<void>;
};

const HistoryContext = createContext<HistoryState | undefined>(undefined);

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `h_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const hydrated = useRef(false);

  // 세션 캐시 복원 (탭 세션 유지)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // 변경 시 세션 캐시에 저장
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* 용량 초과 등은 무시 */
    }
  }, [items]);

  const addHistory = useCallback((data: { counselTarget: string; counselText: string; raw: BWGenogramData }) => {
    setItems((prev) => [
      {
        id: newId(),
        counselTarget: data.counselTarget,
        counselText: data.counselText,
        raw: data.raw,
        createdAt: new Date().toISOString(),
        saved: false,
      },
      ...prev,
    ]);
  }, []);

  const saveToDb = useCallback(async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target || target.saved) return;
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        counselTarget: target.counselTarget,
        counselText: target.counselText,
        raw: target.raw,
        createdAt: target.createdAt,
      }),
    });
    if (!res.ok) throw new Error('저장에 실패했습니다.');
    const data = await res.json();
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, saved: true, dbId: data.dbId } : i)));
  }, [items]);

  // DB에서만 삭제 → 캐시에는 미저장 상태로 남김
  const deleteFromDb = useCallback(async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target || !target.saved || !target.dbId) return;
    const res = await fetch(`/api/history/${target.dbId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error('DB 삭제에 실패했습니다.');
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, saved: false, dbId: undefined } : i)));
  }, [items]);

  // DB + 캐시 모두 삭제
  const removeItem = useCallback(async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target?.saved && target.dbId) {
      await fetch(`/api/history/${target.dbId}`, { method: 'DELETE' }).catch(() => {});
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, [items]);

  // DB 저장 항목을 캐시로 병합 (중복 dbId 제외)
  const syncFromDb = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const saved = (data.items as SavedHistory[]) || [];
      setItems((prev) => {
        const existingDbIds = new Set(prev.filter((i) => i.dbId).map((i) => i.dbId));
        const merged: HistoryItem[] = saved
          .filter((s) => !existingDbIds.has(s.dbId))
          .map((s) => ({
            id: newId(),
            dbId: s.dbId,
            counselTarget: s.counselTarget,
            counselText: s.counselText,
            raw: s.raw,
            createdAt: s.createdAt,
            saved: true,
          }));
        return [...prev, ...merged].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<HistoryState>(
    () => ({ items, loading, addHistory, saveToDb, deleteFromDb, removeItem, syncFromDb }),
    [items, loading, addHistory, saveToDb, deleteFromDb, removeItem, syncFromDb]
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory는 HistoryProvider 내부에서 사용해야 합니다.');
  return ctx;
}
