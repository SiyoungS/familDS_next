import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { userUpdateSchema } from '@/lib/validations/user';

// PATCH /api/users/:id - 기존 사용자 정보 수정(update)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 사용자 ID입니다.' }, { status: 400 });
    }
    const body = await request.json();

    // Zod로 데이터 검증
    const validatedData = userUpdateSchema.safeParse(body);
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
    // 빈 객체 검증: 수정할 데이터가 하나도 제공되지 않았을 때
    if (Object.keys(validatedData.data).length === 0) {
      return NextResponse.json({ success: false, error: '수정할 데이터가 제공되지 않았습니다.' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_PROJECT_NAME);
    const updateResult = await db.collection('users').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: validatedData.data }
    );
    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ success: false, error: '해당 유저를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '유저 정보가 수정되었습니다.' });
    
  } catch (error) {
    console.error('User Update Error:', error);
    return NextResponse.json({ success: false, error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
// PATCH 호출 예시: 'use client'가 있는 컴포넌트 예시
// const handleUpdateUser = async (userId: string, newName: string) => {
//   try {
//     // 수정할 유저의 ID를 URL 경로에 포함시킵니다.
//     const response = await fetch(`/api/users/${userId}`, {
//       method: 'PATCH',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       // Zod 스키마에서 .partial()을 사용했으므로, 수정하고 싶은 데이터(name)만 보내도 됩니다.
//       body: JSON.stringify({ name: newName }), 
//     });

//     const data = await response.json();

//     if (data.success) {
//       alert('유저 정보가 수정되었습니다.');
//       // TODO: 수정된 정보를 화면에 즉시 반영하는 로직을 추가합니다.
//     } else {
//       alert(`수정 실패: ${data.error}`);
//     }
//   } catch (error) {
//     console.error('API 호출 에러:', error);
//     alert('네트워크 오류가 발생했습니다.');
//   }
// };

// DELETE /api/users/:id - 기존 사용자 삭제(delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 유저 ID입니다.' }, 
        { status: 400 }
      );
    }
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_PROJECT_NAME);
    const deleteResult = await db.collection('users').deleteOne({ _id: new ObjectId(params.id) });
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: '해당 유저를 찾을 수 없습니다.' }, 
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: true, message: '유저가 성공적으로 삭제되었습니다.' }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('User Delete Error:', error);
    return NextResponse.json(
      { success: false, error: '서버 내부 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
}
// delete 호출 예시: 'use client'가 있는 컴포넌트 예시
// const handleDelete = async (userId: string) => {
//   // 사용자에게 다시 한번 확인을 받습니다.
//   if (!window.confirm('정말로 이 유저를 삭제하시겠습니까?')) return;

//   try {
//     const response = await fetch(`/api/users/${userId}`, {
//       method: 'DELETE',
//     });

//     const data = await response.json();

//     if (data.success) {
//       alert('삭제되었습니다.');
//       // TODO: 화면에서 삭제된 유저를 목록에서 제거하거나(상태 업데이트), 
//       // 페이지를 새로고침하여 최신 목록을 반영합니다.
//     } else {
//       alert(data.error);
//     }
//   } catch (error) {
//     alert('네트워크 오류가 발생했습니다.');
//   }
// };