import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { bwGenogramSchema } from "./genai-schema";

interface GeminiRequestBody {
  counselText: string;
  counselTarget: string;
  prompt: string;
}
type GeminiModelName = "gemini-3.5-flash" | "gemini-3.1-flash-lite";
const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

/**
 * @param requestBody 프롬프트 및 입력 데이터
 * @param modelName 'gemini-3.1-pro' 또는 'gemini-3.5-flash'
 */
export async function CallGemini(
  requestBody: GeminiRequestBody,
  modelName: GeminiModelName = "gemini-3.1-flash-lite"
) {
  const { counselText, counselTarget, prompt } = requestBody;
  try {
    const response = await genai.models.generateContent({
      model: modelName,
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
      console.log("Raw response from Gemini:", rawContent); // 디버깅용 로그
    }
    
    return JSON.parse(rawContent);
  } catch (error) {
    console.error(`Error in CallGemini using model ${modelName}:`, error);
    throw new Error("CallGemini: Data generation failed");
  }
}