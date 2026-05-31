import { NextResponse } from 'next/server';
import fs from 'fs/promises'; // 비동기 버전 사용 권장
import path from 'path';
import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';
import { calculateGenogramLayout } from '@/lib/genograms/bowen/calculator-nodes';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  try {
    const fileName = 'mockdata_2.jsonl';
    console.log(`Attempting to read file: ${fileName}`); // 디버깅용 로그
    const filePath = path.join(process.cwd(), 'lib', fileName);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const testEnv = process.env.TEST_ENV || 'default';
    console.log(`Current TEST_ENV: ${testEnv}`);

    await delay(2000);
    // JSON 파싱 시도
    const rawData = JSON.parse(fileContent);
    const orderedData = reorderDisplayOrders(rawData);
    const processedData = calculateGenogramLayout(orderedData);
    console.log('Processed Genogram Data:', JSON.stringify(processedData, null, 2));// 디버깅용 로그
    return NextResponse.json(processedData);
  } catch (error) {
    console.error('Data Load Error:', error);
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 500 });
  }
}