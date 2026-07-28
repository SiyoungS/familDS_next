import { GoogleGenAI } from "@google/genai";
import type { ThinkingLevel } from "@google/genai";

// Gemini 호출 공용 헬퍼: 클라이언트 인스턴스 + 모델 폴백 체인 로직을 한 곳에 모은다.
// (CallGemini / CallGeminiRelations / CallGeminiEmotions가 공통으로 사용)
//
// 체인 순서: gemini-3.6-flash → gemini-3.5-flash-lite → gemini-2.5-flash
// - 신세대 모델(3.6-flash, 3.5-flash-lite)은 thinkingConfig.thinkingLevel을 지원한다.
// - 구세대 모델(2.5-flash)은 thinkingLevel을 지원하지 않으므로(thinkingBudget 방식) thinkingConfig를 생략한다.
// - 신세대 모델은 temperature/top_p/top_k/seed 등 샘플링 파라미터를 보내면 400 에러가 나므로,
//   모든 모델 공통으로 샘플링 파라미터는 사용하지 않는다.

export type GeminiModelName =
  | "gemini-3.6-flash"
  | "gemini-3.5-flash-lite"
  | "gemini-2.5-flash";

export const GEMINI_MODEL_CHAIN: GeminiModelName[] = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
];

export const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// 모델 세대별로 thinkingConfig 유무를 분기한다.
function buildThinkingConfig(model: GeminiModelName) {
  if (model === "gemini-2.5-flash") {
    // 구세대 모델: thinkingLevel 미지원(thinkingBudget 방식)이므로 thinkingConfig를 생략하고 기본값을 쓴다
    return {};
  }
  // SDK 타입 정의는 thinkingLevel을 대문자 enum("MEDIUM" 등)으로 선언하고 있지만,
  // 실제 Gemini API는 소문자 문자열을 받고 SDK도 값을 검증 없이 그대로 전달한다.
  // 실 API 검증을 거친 소문자 값을 유지하기 위해 타입만 단언으로 맞춘다.
  return {
    thinkingConfig: { thinkingLevel: "minimal" as unknown as ThinkingLevel },
  };
}

interface GenerateGeminiJsonParams {
  /** 호출 주체 이름 (로그 식별용, 예: "CallGemini") */
  callerName: string;
  contents: string;
  systemInstruction: string;
  responseSchema: object;
}

/**
 * 모델 폴백 체인(GEMINI_MODEL_CHAIN)을 순서대로 시도하며 JSON 응답을 생성한다.
 * 앞 모델이 실패(예외/빈 응답/JSON 파싱 실패)하면 다음 모델로 재시도하고,
 * 체인의 모든 모델이 실패하면 예외를 던진다.
 */
export async function generateGeminiJson({
  callerName,
  contents,
  systemInstruction,
  responseSchema,
}: GenerateGeminiJsonParams): Promise<any> {
  for (let i = 0; i < GEMINI_MODEL_CHAIN.length; i++) {
    const model = GEMINI_MODEL_CHAIN[i];
    try {
      const response = await genai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          ...buildThinkingConfig(model),
        },
      });
      const rawContent = response.text;

      if (!rawContent) {
        throw new Error("Empty response from Gemini");
      }
      console.log(`Raw response from Gemini (${model}):`, rawContent); // 디버깅용 로그

      return JSON.parse(rawContent);
    } catch (error) {
      console.error(`Error in ${callerName} using model ${model}:`, error);
      if (i < GEMINI_MODEL_CHAIN.length - 1) {
        console.warn(
          `${callerName}: ${model} 실패 → 폴백 모델 ${GEMINI_MODEL_CHAIN[i + 1]}(으)로 재시도`
        );
      }
    }
  }
  throw new Error(`${callerName}: Data generation failed`);
}
