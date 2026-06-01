import OpenAI from 'openai';
interface OpenAIRequestBody {
  counselText: string;
  counselTarget: string;
  prompt:string;
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
export async function CallOpenAI(requestBody: OpenAIRequestBody) {
  const { counselText, counselTarget, prompt } = requestBody;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-2024-11-20",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `IP: ${counselTarget}\n${counselText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      modalities: ["text"],
    });
    const rawContent = response.choices[0].message.content!;
    const rawData = JSON.parse(rawContent);
    return rawData;
  } catch (error) {
    console.error("Error in CallOpenAI:", error);
    throw new Error("CallOpenAI: Data generation failed");
  }
}