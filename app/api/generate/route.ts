import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSystemPrompt_bowen } from '@/lib/prompt-loader';
import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';
import { calculateGenogramLayout } from '@/lib/genograms/bowen/calculator-nodes';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const getThisYear = (timezoneOffset:number) => {
  const now = new Date(); 
  const utc = now.getTime() + (now.getTimezoneOffset()*60*1000);
  const selectedDate = new Date(utc - (timezoneOffset*60*1000));
  const year = selectedDate.getFullYear();
  return year;
}
export async function POST(req: Request) {
  const { counselText, counselTarget } = await req.json();
  const timezoneOffset = new Date().getTimezoneOffset();
  console.log(`timezoneOffset : ${timezoneOffset}`);
  const thisYear = getThisYear(timezoneOffset);
  console.log(`thisYear : ${thisYear}`);
  const systemPrompt = getSystemPrompt_bowen().replace("{--TEXT_THIS_YEAR--}", thisYear.toString());

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-2024-11-20",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `IP: ${counselTarget}\n${counselText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      modalities: ["text"],
    });
    const rawContent = response.choices[0].message.content!;
    const rawData = JSON.parse(rawContent);
    const orderedData = reorderDisplayOrders(rawData);
    const processedData = calculateGenogramLayout(orderedData);
    console.log('Processed Genogram Data:', JSON.stringify(processedData));// 디버깅용 로그
    return NextResponse.json(processedData);
  } catch (error) {
    return NextResponse.json({ error: "Data generation failed" }, { status: 500 });
  }
}