import { BWGenogramData } from '@/types/bowengenogram.types';

// 클라이언트 세션 캐시의 히스토리 항목
export interface HistoryItem {
  id: string;            // 클라이언트 로컬 고유 id
  dbId?: string;         // MongoDB _id (저장된 경우)
  counselTarget: string; // 내담자명
  counselText: string;   // 입력 상담 내용
  raw: BWGenogramData;   // 가공 전 Gemini 원본 데이터
  createdAt: string;     // ISO 문자열 (날짜/시간)
  saved: boolean;        // DB 저장 여부
}

// DB에서 내려오는 저장 항목
export interface SavedHistory {
  dbId: string;
  counselTarget: string;
  counselText: string;
  raw: BWGenogramData;
  createdAt: string;
}
