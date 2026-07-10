import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { bwGenogramSchema } from "./genai-schema";

interface GeminiRequestBody {
  counselText: string;
  counselTarget: string;
  prompt: string;
}
// type GeminiModelName = "gemini-3.5-flash" | "gemini-3.1-flash-lite";
type GeminiModelName = "gemini-3.5-flash" | "gemini-3.1-flash-lite"|"gemini-2.5-flash";

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

/**
 * @param requestBody 프롬프트 및 입력 데이터
 * @param modelName 'gemini-3.1-pro' 또는 'gemini-3.5-flash'
 */
export async function CallGemini(
  requestBody: GeminiRequestBody,
  modelName: GeminiModelName = "gemini-3.5-flash"
) {
  const { counselText, counselTarget, prompt } = requestBody;
  // 503(과부하) 등 일시 장애 대비: 기본 모델 실패 시 폴백 모델로 1회 재시도
  const models: GeminiModelName[] =
    modelName === "gemini-2.5-flash" ? [modelName] : [modelName, "gemini-2.5-flash"];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await genai.models.generateContent({
        model,
        contents: `### [Identified Patient (IP)]\n${counselTarget}\n\n### [Counseling Scenario]\n${counselText}`,
        config: {
          systemInstruction: prompt,
          responseMimeType: "application/json",
          responseSchema: bwGenogramSchema,
          // 결정적(일정한) 출력을 위해 temperature 0 + 고정 seed 사용
          temperature: 0,
          seed: 42,
        }
      })
      const rawContent = response.text;

      if (!rawContent) {
        throw new Error("Empty response from Gemini");
      } else {
        console.log(`Raw response from Gemini (${model}):`, rawContent); // 디버깅용 로그
      }

      return JSON.parse(rawContent);
    } catch (error) {
      console.error(`Error in CallGemini using model ${model}:`, error);
      if (i < models.length - 1) {
        console.warn(`CallGemini: ${model} 실패 → 폴백 모델 ${models[i + 1]}(으)로 재시도`);
      }
    }
  }
  throw new Error("CallGemini: Data generation failed");
}