import { ApiMode } from '@/types/api-loaders.type';
import fs from 'fs';
import path from 'path';
import { getPromptText, type PromptKey } from './db/prompts';

// key ↔ 파일 폴백 default 경로 매핑
const FALLBACK_ENV: Record<PromptKey, { envVar: string; defaultPath: string }> = {
  contents: { envVar: 'PROMPT_FILE_PATH', defaultPath: './lib/.prompt.env.txt' },
  interface: { envVar: 'PROMPT_TYPE_INTERFACE_FILE_PATH', defaultPath: './lib/.prompt-interface.env.txt' },
  relations: { envVar: 'PROMPT_RELATIONS_FILE_PATH', defaultPath: './lib/prompt-relations.env.txt' },
  emotions: { envVar: 'PROMPT_EMOTIONS_FILE_PATH', defaultPath: './lib/prompt-emotions.env.txt' },
};

// DB 우선 → 없으면 파일 폴백으로 프롬프트 조각을 획득한다.
async function loadPromptPart(key: PromptKey): Promise<string> {
  const fromDb = await getPromptText(key);
  if (fromDb != null) {
    return fromDb;
  }
  console.warn(`DB에 ${key} 프롬프트 없음, 파일 폴백`);
  const { envVar, defaultPath } = FALLBACK_ENV[key];
  const filePath = path.join(process.cwd(), process.env[envVar] || defaultPath);
  return fs.readFileSync(filePath, 'utf8');
}

export async function getSystemPrompt_bowen(apiMode: ApiMode, thisYear: number): Promise<string> {
  if (apiMode === "openai") {
    const contents = await loadPromptPart('contents');
    const interfacePart = await loadPromptPart('interface');
    const promptContent = contents + "\n\n" + interfacePart;
    return promptContent.replace("{--TEXT_THIS_YEAR--}", thisYear.toString());
  } else if (apiMode === "gemini") {
    const contents = await loadPromptPart('contents');
    return contents.replace("{--TEXT_THIS_YEAR--}", thisYear.toString());
  }
  return "";
}

// [프롬프트 체이닝 2차] 관계 추출용 시스템 프롬프트
export async function getRelationsPrompt(): Promise<string> {
  return loadPromptPart('relations');
}

// [프롬프트 체이닝 2차] 정서 관계선 추출용 시스템 프롬프트
export async function getEmotionsPrompt(): Promise<string> {
  return loadPromptPart('emotions');
}
