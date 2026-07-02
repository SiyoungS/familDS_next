import { NextResponse } from 'next/server';

import { getSystemPrompt_bowen } from '@/lib/prompt-loader';
import { processGenogramData } from '@/lib/genograms/bowen/process';
import { CallOpenAI } from './openai-route';
import { ApiMode } from '@/types/api-loaders.type';
import { CallGemini } from './genai-route';


const getThisYear = (timezoneOffset:number) => {
  const now = new Date(); 
  const utc = now.getTime() + (now.getTimezoneOffset()*60*1000);
  const selectedDate = new Date(utc - (timezoneOffset*60*1000));
  const year = selectedDate.getFullYear();
  return year;
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
    const processedData = processGenogramData(rawData);
    console.log("Processed Genogram Data with Layout");
    // raw(가공 전)는 히스토리 저장/재처리용, processed는 화면 표시용
    return NextResponse.json({ raw: rawData, processed: processedData });
  } catch (error) {
    return NextResponse.json({ error: "Data generation failed" }, { status: 500 });
  }
}