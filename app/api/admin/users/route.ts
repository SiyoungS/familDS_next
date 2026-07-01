import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listUsers, updateUserStatus } from '@/lib/db/users';
import type { AppUser, UserStatus } from '@/types/auth';

export const runtime = 'nodejs';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || session.status !== 'approved') {
    return null;
  }
  return session;
}

// 관리자 화면에 내려줄 정보 (비밀번호 등 민감정보 없음)
function toAdminView(u: AppUser) {
  return {
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    photoURL: u.photoURL,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt ?? null,
    approvedAt: u.approvedAt ?? null,
  };
}

// GET /api/admin/users — 전체 사용자 목록 (관리자 전용)
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }
  const users = await listUsers();
  return NextResponse.json({ users: users.map(toAdminView) });
}

// PATCH /api/admin/users — 승인 상태 변경 (관리자 전용)
// body: { email: string, status: 'approved' | 'pending' | 'rejected' }
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const { email, status } = await request.json();
  const allowed: UserStatus[] = ['approved', 'pending', 'rejected'];
  if (!email || !allowed.includes(status)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  // 관리자 자신의 상태는 변경 불가(자기 잠금 방지)
  if (String(email).toLowerCase() === admin.email) {
    return NextResponse.json({ error: '본인 계정의 상태는 변경할 수 없습니다.' }, { status: 400 });
  }

  const ok = await updateUserStatus(email, status);
  if (!ok) {
    return NextResponse.json({ error: '해당 사용자를 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
