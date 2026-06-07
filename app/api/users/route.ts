import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { userSchema } from '@/lib/validations/user';

// POST /api/users - 새로운 사용자 생성(create)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Zod로 데이터 검증
    const validatedData = userSchema.safeParse(body);
    if (!validatedData.success) {
      // 검증 실패
      return NextResponse.json(
        { 
          success: false, 
          error: '잘못된 입력값입니다.', 
          details: validatedData.error
        },
        { status: 400 }
      );
    }
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_PROJECT_NAME);
    const existingUser = await db.collection('users').findOne({ email: validatedData.data.email });
    if (existingUser) {
      return NextResponse.json({ success: false, error: '이미 존재하는 이메일입니다.' }, { status: 409 });
    }

    // 원본 body가 아닌 'validatedData.data'만 DB에 삽입 (보안)
    const result = await db.collection('users').insertOne(validatedData.data);

    return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
  } catch (error) {
    // 에러 처리는 서버 내부에만 로그를 남기고, 클라이언트에는 일반적인 에러 메시지만 전달.
    console.error('User Create Error:', error);
    return NextResponse.json({ success: false, error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
// POST 호출 예시: 'use client'가 있는 컴포넌트 예시
// const handleCreateUser = async (name: string, email: string) => {
//   try {
//     const response = await fetch('/api/users', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json', // JSON 데이터를 보낸다고 명시합니다.
//       },
//       body: JSON.stringify({ name, email }), // 입력받은 데이터를 JSON 문자열로 변환합니다.
//     });

//     const data = await response.json();

//     if (data.success) {
//       alert('유저가 성공적으로 생성되었습니다!');
//       console.log('새로 생성된 유저 ID:', data.id);
      
//       // TODO: 데이터가 생성되었으므로 화면의 목록을 갱신하는 로직을 추가합니다.
//     } else {
//       // Zod 검증 실패 시 상세 에러가 있다면 콘솔에 출력합니다.
//       if (data.details) console.log('검증 에러 상세:', data.details);
//       alert(`생성 실패: ${data.error}`);
//     }
//   } catch (error) {
//     console.error('API 호출 에러:', error);
//     alert('네트워크 오류가 발생했습니다.');
//   }
// };