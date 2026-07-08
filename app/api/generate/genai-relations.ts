import { GoogleGenAI, Type } from "@google/genai";
import { getRelationsPrompt } from "@/lib/prompt-loader";

// [프롬프트 체이닝 2차] 확정된 가족 구조 + 상담 텍스트로 '부부 관계 상태'만 추출한다.
// (구조는 절대 변경하지 않고, 각 familyUnit의 legal_status/연도만 채운다)
// 시스템 프롬프트는 lib/prompt-relations.env.txt 에서 로드한다.

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const relationsSchema = {
  type: Type.OBJECT,
  properties: {
    familyRelations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          unit_id: { type: Type.STRING },
          legal_status: {
            type: Type.STRING,
            enum: ['married', 'common_law', 'separated', 'divorced', 'reconciled', 'null'],
          },
          marriage_year: { type: Type.NUMBER },
          cohabitation_year: { type: Type.NUMBER },
          separation_year: { type: Type.NUMBER },
          divorce_year: { type: Type.NUMBER },
          reunion_year: { type: Type.NUMBER },
        },
        required: ["unit_id", "legal_status"],
      },
    },
  },
  required: ["familyRelations"],
};

type GeminiModelName = "gemini-3.5-flash" | "gemini-3.1-flash-lite"|"gemini-2.5-flash";

export interface FamilyRelation {
  unit_id: string;
  legal_status: 'married' | 'common_law' | 'separated' | 'divorced' | 'reconciled' | 'null';
  marriage_year?: number;
  cohabitation_year?: number;
  separation_year?: number;
  divorce_year?: number;
  reunion_year?: number;
}

export async function CallGeminiRelations(
  params: { counselText: string; structureSummary: string; thisYear: number },
  // modelName: GeminiModelName = "gemini-3.1-flash-lite"
  modelName: GeminiModelName = "gemini-2.5-flash"
): Promise<FamilyRelation[]> {
  const { counselText, structureSummary, thisYear } = params;
  const response = await genai.models.generateContent({
    model: modelName,
    contents: `### [현재 연도]\n${thisYear}\n\n### [가족 단위 목록]\n${structureSummary}\n\n### [상담 내용]\n${counselText}`,
    config: {
      systemInstruction: getRelationsPrompt(),
      responseMimeType: "application/json",
      responseSchema: relationsSchema,
      temperature: 0,
      seed: 42,
    },
  });

  const rawContent = response.text;
  if (!rawContent) throw new Error("Empty relations response from Gemini");
  const parsed = JSON.parse(rawContent);
  return (parsed.familyRelations || []) as FamilyRelation[];
}
