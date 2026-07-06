import { NextResponse } from 'next/server';

import { getSystemPrompt_bowen } from '@/lib/prompt-loader';
import { processGenogramData } from '@/lib/genograms/bowen/process';
import { CallOpenAI } from './openai-route';
import { ApiMode } from '@/types/api-loaders.type';
import { CallGemini } from './genai-route';
import { CallGeminiRelations, type FamilyRelation } from './genai-relations';


const getThisYear = (timezoneOffset:number) => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset()*60*1000);
  const selectedDate = new Date(utc - (timezoneOffset*60*1000));
  const year = selectedDate.getFullYear();
  return year;
}

// 확정된 구조를 '부부 목록' 요약 문자열로 (2차 관계 추출 호출의 입력)
function buildStructureSummary(data: any): string {
  const nameOf = (id: string) => data.nodes?.find((n: any) => n.id === id)?.name || `(${id})`;
  return (data.familyUnits || [])
    .map((u: any) => `${u.id}: ${(u.parent_ids || []).map(nameOf).join(' ↔ ')}`)
    .join('\n');
}

// 2차에서 받은 관계(legal_status/연도)를 구조에 병합 (구조는 유지, 관계 필드만 채움)
function applyRelations(data: any, relations: FamilyRelation[]) {
  const byId = new Map(relations.map((r) => [r.unit_id, r]));
  (data.familyUnits || []).forEach((u: any) => {
    const r = byId.get(u.id);
    if (!r) return;
    u.legal_status = r.legal_status;
    if (r.marriage_year != null) u.marriage_year = r.marriage_year;
    if (r.cohabitation_year != null) u.cohabitation_year = r.cohabitation_year;
    if (r.separation_year != null) u.separation_year = r.separation_year;
    if (r.divorce_year != null) u.divorce_year = r.divorce_year;
    if (r.reunion_year != null) u.reunion_year = r.reunion_year;
  });
}

export async function POST(req: Request) {
  const { counselText, counselTarget } = await req.json();
  
  const selectAPI:ApiMode = "gemini"; 

  const timezoneOffset = new Date().getTimezoneOffset();
  console.log(`timezoneOffset : ${timezoneOffset}`);
  const thisYear = getThisYear(timezoneOffset);
  console.log(`thisYear : ${thisYear}`);

  const systemPrompt = getSystemPrompt_bowen(selectAPI, thisYear);
  let rawData:any = null;
  try {
    if (selectAPI === "gemini") {
      rawData = await CallGemini({
        counselText,
        counselTarget,
        prompt: systemPrompt,
      }).catch((geminiError) => {
        console.error("Error calling Gemini:", geminiError);
        throw new Error("Gemini API call failed");
      });
    } else if (selectAPI === "openai") {
      rawData = await CallOpenAI({
        counselText,
        counselTarget,
        prompt: systemPrompt,
      }).catch((openaiError) => {
        console.error("Error calling OpenAI:", openaiError);
        throw new Error("OpenAI API call failed");
      });
    } else {
      throw new Error("Invalid API selection");
    }
    // [프롬프트 체이닝 2차] 확정된 구조로 부부 관계 상태만 추출 → 병합.
    // 실패해도 1차 구조의 legal_status로 폴백(전체 실패로 만들지 않음).
    try {
      if (selectAPI === "gemini" && rawData?.familyUnits?.length) {
        const structureSummary = buildStructureSummary(rawData);
        const relations = await CallGeminiRelations({ counselText, structureSummary, thisYear });
        applyRelations(rawData, relations);
        console.log(`Relations merged: ${relations.length} units`);
      }
    } catch (relErr) {
      console.error("Relations chaining failed (fallback to structure legal_status):", relErr);
    }

    const processedData = processGenogramData(rawData);
    console.log("Processed Genogram Data with Layout");
    // raw(가공 전)는 히스토리 저장/재처리용, processed는 화면 표시용
    return NextResponse.json({ raw: rawData, processed: processedData });
  } catch (error) {
    return NextResponse.json({ error: "Data generation failed" }, { status: 500 });
  }
}