import { ApiMode } from '@/types/api-loaders.type';
import fs from 'fs';
import path from 'path';

export function getSystemPrompt_bowen(apiMode: ApiMode, thisYear: number): string {
  
  if (apiMode === "openai") {
    const filePath_prompt = path.join(process.cwd(), process.env.PROMPT_FILE_PATH || './lib/.prompt.env.txt');
    const filePath_interface = path.join(process.cwd(), process.env.PROMPT_TYPE_INTERFACE_FILE_PATH || './lib/.prompt-interface.env.txt');
    const interfaceContent = fs.readFileSync(filePath_interface, 'utf8');
    const promptContent = fs.readFileSync(filePath_prompt, 'utf8') + "\n\n" + interfaceContent;
    return promptContent.replace("{--TEXT_THIS_YEAR--}", thisYear.toString());
  } else if (apiMode === "gemini") {
    const filePath_gemini = path.join(process.cwd(), process.env.PROMPT_FILE_PATH || './lib/.prompt.env.txt');
    const promptContent = fs.readFileSync(filePath_gemini, 'utf8');
    return promptContent.replace("{--TEXT_THIS_YEAR--}", thisYear.toString());
  }
  return "";
}

// [프롬프트 체이닝 2차] 관계 추출용 시스템 프롬프트
export function getRelationsPrompt(): string {
  const filePath = path.join(
    process.cwd(),
    process.env.PROMPT_RELATIONS_FILE_PATH || './lib/prompt-relations.env.txt'
  );
  return fs.readFileSync(filePath, 'utf8');
}