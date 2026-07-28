import { bwGenogramSchema } from "./genai-schema";
import { generateGeminiJson } from "./genai-client";

interface GeminiRequestBody {
  counselText: string;
  counselTarget: string;
  prompt: string;
}

/**
 * @param requestBody 프롬프트 및 입력 데이터
 * 모델 폴백 체인(gemini-3.6-flash → gemini-3.5-flash-lite → gemini-2.5-flash)을
 * 순서대로 시도한다. 자세한 폴백/설정 로직은 genai-client.ts 참고.
 */
export async function CallGemini(requestBody: GeminiRequestBody) {
  const { counselText, counselTarget, prompt } = requestBody;

  return generateGeminiJson({
    callerName: "CallGemini",
    contents: `### [Identified Patient (IP)]\n${counselTarget}\n\n### [Counseling Scenario]\n${counselText}`,
    systemInstruction: prompt,
    responseSchema: bwGenogramSchema,
  });
}
