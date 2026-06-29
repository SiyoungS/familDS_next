import { NextResponse } from 'next/server';

import { extractHwpText } from '@/lib/hwp/extract-text';

// HWP 파싱은 Node 내장 zlib/Buffer를 사용하므로 Node.js 런타임 필요
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '파일이 첨부되지 않았습니다.' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.hwp')) {
      return NextResponse.json({ error: '.hwp 확장자 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const text = extractHwpText(buf);

    return NextResponse.json({ fileName: file.name, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'HWP 텍스트 추출에 실패했습니다.';
    console.error('hwp2txt error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
