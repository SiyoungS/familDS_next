import { GoogleGenAI, Type } from "@google/genai";
import { getEmotionsPrompt } from "@/lib/prompt-loader";

// [프롬프트 체이닝 2차] 확정된 인물 목록 + 상담 텍스트로 '정서 관계선'만 전담 추출한다.
// (인물/구조는 절대 변경하지 않고, 상담 본문에 근거가 명시된 인물 쌍의 emotional_status만 반환한다)
// 시스템 프롬프트는 lib/prompt-emotions.env.txt 에서 로드한다.

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const emotionsSchema = {
  type: Type.OBJECT,
  properties: {
    emotionalLinks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          emotional_status: {
            type: Type.STRING,
            enum: ['close', 'fused', 'conflictual', 'fused_conflictual', 'distant', 'cut_off', 'hostile'],
          },
        },
        required: ["from", "to", "emotional_status"],
      },
    },
  },
  required: ["emotionalLinks"],
};

type GeminiModelName = "gemini-3.5-flash" | "gemini-3.1-flash-lite" | "gemini-2.5-flash";

export interface EmotionalLinkResult {
  from: string;
  to: string;
  emotional_status: 'close' | 'fused' | 'conflictual' | 'fused_conflictual' | 'distant' | 'cut_off' | 'hostile';
}

export async function CallGeminiEmotions(
  params: { counselText: string; nodeSummary: string },
  // modelName: GeminiModelName = "gemini-3.1-flash-lite"
  modelName: GeminiModelName = "gemini-2.5-flash"
): Promise<EmotionalLinkResult[]> {
  const { counselText, nodeSummary } = params;
  const response = await genai.models.generateContent({
    model: modelName,
    contents: `### [인물 목록]\n${nodeSummary}\n\n### [상담 내용]\n${counselText}`,
    config: {
      systemInstruction: await getEmotionsPrompt(),
      responseMimeType: "application/json",
      responseSchema: emotionsSchema,
      temperature: 0,
      seed: 42,
    },
  });

  const rawContent = response.text;
  if (!rawContent) throw new Error("Empty emotions response from Gemini");
  const parsed = JSON.parse(rawContent);
  return (parsed.emotionalLinks || []) as EmotionalLinkResult[];
}
