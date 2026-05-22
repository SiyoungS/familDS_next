import { NextResponse } from 'next/server';
import fs from 'fs/promises'; // 비동기 버전 사용 권장
import path from 'path';
import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';
import { calculateGenogramLayout } from '@/lib/genograms/bowen/calculator-nodes';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'lib', 'mockdata_2.jsonl');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const testEnv = process.env.TEST_ENV || 'default';
    console.log(`Current TEST_ENV: ${testEnv}`);

    
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