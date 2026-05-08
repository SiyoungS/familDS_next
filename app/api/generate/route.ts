import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSystemPrompt_old, getSystemPrompt_bowen } from '@/lib/prompt-loader';
import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { counselText, counselTarget } = await req.json();
  const systemPrompt = getSystemPrompt_bowen();

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
    const processedData = reorderDisplayOrders(rawData);
    console.log('Processed Genogram Data:', JSON.stringify(processedData));// 디버깅용 로그
    return NextResponse.json(processedData);
  } catch (error) {
    return NextResponse.json({ error: "Data generation failed" }, { status: 500 });
  }
}