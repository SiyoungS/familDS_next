import { NextResponse } from 'next/server';

import { getSystemPrompt_bowen } from '@/lib/prompt-loader';
import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';
import { calculateGenogramLayout } from '@/lib/genograms/bowen/calculator-nodes';
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
    const orderedData = reorderDisplayOrders(rawData);
    console.log("Ordered Genogram Data");
    const processedData = calculateGenogramLayout(orderedData);
    console.log("Processed Genogram Data with Layout");
    console.log('Processed Genogram Data:', JSON.stringify(processedData));// 디버깅용 로그
    return NextResponse.json(processedData);
  } catch (error) {
    return NextResponse.json({ error: "Data generation failed" }, { status: 500 });
  }
}