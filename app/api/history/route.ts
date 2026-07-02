import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listHistory, saveHistory } from '@/lib/db/history';

export const runtime = 'nodejs';

// GET /api/history — 본인 저장 히스토리 목록
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const items = await listHistory(session.email);
  return NextResponse.json({ items });
}

// POST /api/history — 히스토리 저장 (본인 소유)
// body: { counselTarget, counselText, raw, createdAt? }
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || !body.raw || typeof body.counselTarget !== 'string') {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const dbId = await saveHistory({
    ownerEmail: session.email,
    counselTarget: body.counselTarget,
    counselText: typeof body.counselText === 'string' ? body.counselText : '',
    raw: body.raw,
    createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
  });
  return NextResponse.json({ ok: true, dbId });
}
