import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createInquiry, listAllInquiries, listUserInquiries } from '@/lib/db/inquiries';
import type { AppInquiry } from '@/types/inquiry';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.role === 'admin') {
    const inquiries = await listAllInquiries();
    return NextResponse.json(inquiries.map((item) => ({
      ...item,
      id: String((item as unknown as { _id: { toString: () => string } })._id),
      createdAt: item.createdAt.toISOString(),
    })));
  }

  const inquiries = await listUserInquiries(session.email);
  return NextResponse.json(inquiries.map((item) => ({
    ...item,
    id: String((item as unknown as { _id: { toString: () => string } })._id),
    createdAt: item.createdAt.toISOString(),
  })));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.status !== 'approved') {
    return NextResponse.json({ error: 'Unauthorized or not approved' }, { status: 401 });
  }

  const body = await request.json();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!subject || !message) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
  }

  const inquiry: Omit<AppInquiry, 'createdAt' | 'status'> = {
    subject,
    message,
    authorEmail: session.email,
    authorName: session.name || session.email,
    authorRole: session.role,
    attachments,
  };

  await createInquiry(inquiry);
  return NextResponse.json({ success: true });
}
