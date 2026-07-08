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
    return NextResponse.json(
      inquiries.map((item) => ({
        id: String((item as unknown as { _id: { toString: () => string } })._id),
        subject: item.subject,
        message: item.message,
        authorEmail: item.authorEmail,
        authorName: item.authorName,
        authorRole: item.authorRole,
        createdAt: item.createdAt.toISOString(),
        status: item.status,
        reply: item.reply,
        repliedAt: item.repliedAt ? item.repliedAt.toISOString() : undefined,
        repliedBy: item.repliedBy,
        attachments: item.attachments,
      }))
    );
  }

  const inquiries = await listUserInquiries(session.email);
  return NextResponse.json(
    inquiries.map((item) => ({
      id: String((item as unknown as { _id: { toString: () => string } })._id),
      subject: item.subject,
      message: item.message,
      authorName: item.authorName,
      authorRole: item.authorRole,
      createdAt: item.createdAt.toISOString(),
      status: item.status,
      reply: item.reply,
      repliedAt: item.repliedAt ? item.repliedAt.toISOString() : undefined,
      repliedBy: item.repliedBy,
      attachments: item.attachments,
    }))
  );
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

  // server-side validation: prevent forged attachments (must be data URLs and images)
  for (const a of attachments) {
    if (!a || typeof a !== 'object') {
      return NextResponse.json({ error: 'Invalid attachment format' }, { status: 400 });
    }
    const { name, mime, dataUrl } = a as { name?: unknown; mime?: unknown; dataUrl?: unknown };
    if (typeof name !== 'string' || typeof mime !== 'string' || typeof dataUrl !== 'string') {
      return NextResponse.json({ error: 'Invalid attachment fields' }, { status: 400 });
    }
    if (!dataUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'Attachment must be a data URL' }, { status: 400 });
    }
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image attachments are allowed' }, { status: 400 });
    }
    // limit each attachment size ~1.2MB in base64 form
    if (dataUrl.length > 1_200_000) {
      return NextResponse.json({ error: 'Attachment too large' }, { status: 400 });
    }
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
