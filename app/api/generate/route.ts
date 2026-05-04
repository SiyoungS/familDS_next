import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSystemPrompt } from '@/lib/prompt-loader';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { counselText, counselTarget } = await req.json();
  const systemPrompt = getSystemPrompt();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-2024-11-20",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `대상자: ${counselTarget}\n${counselText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      modalities: ["text"],

    });
    // response.
    console.log('Raw response from OpenAI:', JSON.stringify(JSON.parse(response.choices[0].message.content!))); // 디버깅용 로그
    return NextResponse.json(JSON.parse(response.choices[0].message.content!));
  } catch (error) {
    return NextResponse.json({ error: "Data generation failed" }, { status: 500 });
  }
}