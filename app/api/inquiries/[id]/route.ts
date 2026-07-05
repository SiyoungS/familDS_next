import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { deleteInquiry, updateInquiryReply } from '@/lib/db/inquiries';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await request.json();
  const reply = String(body.reply || '').trim();
  if (!reply) {
    return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
  }

  await updateInquiryReply(id, reply, session.name || session.email);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  await deleteInquiry(id);
  return NextResponse.json({ success: true });
}
