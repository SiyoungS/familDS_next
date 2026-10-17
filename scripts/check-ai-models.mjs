// scripts/check-ai-models.mjs
//
// 앱에서 사용하는 AI 모델들이 현재 파라미터 조합으로 실제 응답하는지 1회씩 점검하는 스크립트.
// (앱 화면에서는 Gemini 1순위 모델만 타기 때문에 폴백 모델·OpenAI 경로는 여기서 따로 확인한다.)
//
// 실행 방법:
//   node scripts/check-ai-models.mjs            # Gemini 체인 + OpenAI 모두 점검
//   node scripts/check-ai-models.mjs --gemini   # Gemini 체인만
//   node scripts/check-ai-models.mjs --openai   # OpenAI만
//
// - 모델·파라미터는 app/api/generate/genai-client.ts, openai-route.ts 와 동일하게 맞춘다.
//   (두 파일을 바꾸면 이 스크립트도 함께 갱신할 것)
// - API 키 값은 출력하지 않는다. 호출 1회당 짧은 프롬프트라 비용은 미미하다.

import nextEnv from '@next/env';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const { loadEnvConfig } = nextEnv;

// Next.js 앱과 동일하게 .env(.local 등)를 로드한다.
loadEnvConfig(process.cwd());

// genai-client.ts 의 GEMINI_MODEL_CHAIN 과 동일
const GEMINI_MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
// openai-route.ts 와 동일
const OPENAI_MODEL = 'gpt-6-luna';

const PROMPT = '다음 JSON만 반환하세요: {"ok": true}';

const args = process.argv.slice(2);
const runGemini = args.length === 0 || args.includes('--gemini');
const runOpenAI = args.length === 0 || args.includes('--openai');

const results = [];

async function check(label, fn) {
  const started = Date.now();
  try {
    const text = await fn();
    const parsed = JSON.parse(text);
    const ok = parsed?.ok === true;
    results.push({ label, ok, ms: Date.now() - started, detail: ok ? '' : `예상과 다른 응답: ${text.slice(0, 120)}` });
  } catch (error) {
    const status = error?.status ?? error?.code ?? '';
    const message = (error?.message ?? String(error)).split('\n')[0].slice(0, 200);
    results.push({ label, ok: false, ms: Date.now() - started, detail: `${status} ${message}`.trim() });
  }
}

if (runGemini) {
  if (!process.env.GEMINI_API_KEY) {
    results.push({ label: 'Gemini', ok: false, ms: 0, detail: 'GEMINI_API_KEY 미설정' });
  } else {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    for (const model of GEMINI_MODEL_CHAIN) {
      // genai-client.ts 의 buildThinkingConfig 와 동일한 분기
      const thinking = model === 'gemini-2.5-flash' ? {} : { thinkingConfig: { thinkingLevel: 'minimal' } };
      await check(`Gemini  ${model}`, async () => {
        const response = await genai.models.generateContent({
          model,
          contents: PROMPT,
          config: {
            systemInstruction: 'You return JSON only.',
            responseMimeType: 'application/json',
            responseSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
            ...thinking,
          },
        });
        if (!response.text) throw new Error('빈 응답');
        return response.text;
      });
    }
  }
}

if (runOpenAI) {
  if (!process.env.OPENAI_API_KEY) {
    results.push({ label: 'OpenAI', ok: false, ms: 0, detail: 'OPENAI_API_KEY 미설정' });
  } else {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    await check(`OpenAI  ${OPENAI_MODEL}`, async () => {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        reasoning_effort: 'none',
        messages: [
          { role: 'system', content: 'You return JSON only.' },
          { role: 'user', content: PROMPT },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('빈 응답');
      return content;
    });
  }
}

console.log('\nAI 모델 점검 결과');
for (const r of results) {
  console.log(`${r.ok ? '✅ OK  ' : '❌ FAIL'}  ${r.label.padEnd(32)} ${String(r.ms).padStart(6)}ms  ${r.detail}`);
}
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
