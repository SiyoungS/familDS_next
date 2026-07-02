import { BWGenogramData } from '@/types/bowengenogram.types';
import { normalizeRelLevels } from './normalize-rellevel';
import { reorderDisplayOrders } from './reorder-nodes';
import { calculateGenogramLayout } from './calculator-nodes';

/**
 * Gemini 원본(raw) 데이터 → 화면 표시용 후처리 데이터.
 * 서버(/api/generate)와 클라이언트(히스토리 불러오기)에서 동일하게 사용한다.
 * (relLevel 정규화 → display_order 정렬 → 레이아웃 좌표 계산)
 */
export function processGenogramData(raw: BWGenogramData): BWGenogramData {
  const normalized = normalizeRelLevels(raw);
  const ordered = reorderDisplayOrders(normalized);
  return calculateGenogramLayout(ordered);
}
