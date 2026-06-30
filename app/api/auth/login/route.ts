import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_PROJECT_NAME);
    
    // MongoDB에서 사용자 찾기
    const user = await db.collection('users').findOne({ 
      email: normalizedEmail 
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 계정입니다.' },
        { status: 401 }
      );
    }

    // 비밀번호 검증
    if (user.password !== password) {
      return NextResponse.json(
        { success: false, error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    // 로그인 성공
    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
