import clientPromise from '../mongodb';
import { DB_NAME, PROMPTS_COLLECTION } from '../auth/config';

export type PromptKey = 'contents' | 'interface' | 'relations';

// 문서 스키마: { key: PromptKey, text: string, updatedAt: Date }

// 모듈 레벨 인메모리 캐시 (TTL 5분). null은 캐시하지 않는다.
const TTL = 5 * 60 * 1000;
const cache = new Map<PromptKey, { text: string; expiresAt: number }>();

export async function getPromptText(key: PromptKey): Promise<string | null> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }

  try {
    const client = await clientPromise;
    const doc = await client.db(DB_NAME).collection(PROMPTS_COLLECTION).findOne({ key });
    if (doc && typeof doc.text === 'string') {
      const text = doc.text;
      cache.set(key, { text, expiresAt: Date.now() + TTL });
      return text;
    }
    return null;
  } catch (err) {
    console.warn(`[prompts] DB 조회 실패 (key=${key}):`, err);
    return null;
  }
}
