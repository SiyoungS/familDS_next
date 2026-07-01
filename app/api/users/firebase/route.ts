import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uid, email, name } = body;

    if (!uid || !email) {
      return NextResponse.json({ success: false, error: 'uid와 email이 필요합니다.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_PROJECT_NAME);

    // 이미 uid 또는 email이 있는지 확인
    const existing = await db.collection('users').findOne({ $or: [{ uid }, { email }] });
    if (existing) {
      return NextResponse.json({ success: true, message: '이미 저장된 사용자입니다.' }, { status: 200 });
    }

    const doc = {
      uid,
      email,
      name: name || '',
      createdAt: new Date(),
      // do NOT store passwords for Firebase-managed accounts
    };

    await db.collection('users').insertOne(doc);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Persist Firebase User Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
