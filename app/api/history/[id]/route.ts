import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { deleteHistory } from '@/lib/db/history';

export const runtime = 'nodejs';

// DELETE /api/history/:id — 본인 소유 항목만 DB에서 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteHistory(session.email, id);
  if (!ok) {
    return NextResponse.json({ error: '삭제할 항목을 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
