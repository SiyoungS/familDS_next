// 사용자 컬렉션 접근 헬퍼 (DB/컬렉션명은 .env에서)

import { Collection } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { DB_NAME, USERS_COLLECTION } from '@/lib/auth/config';
import type { AppUser, PublicUser } from '@/types/auth';

export async function getUsersCollection(): Promise<Collection<AppUser>> {
  const client = await clientPromise;
  return client.db(DB_NAME).collection<AppUser>(USERS_COLLECTION);
}

export function toPublicUser(u: AppUser): PublicUser {
  return {
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    photoURL: u.photoURL,
  };
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const col = await getUsersCollection();
  return col.findOne({ email: email.toLowerCase() });
}

/**
 * Google 로그인 시 사용자 upsert.
 * - 신규: status 'pending', role 'user'로 생성 (관리자 승인 필요)
 * - 기존: 로그인 시각/프로필 갱신 (role/status는 유지)
 */
export async function upsertUserOnLogin(params: {
  email: string;
  name: string;
  photoURL?: string;
  consent?: boolean;
}): Promise<AppUser> {
  const col = await getUsersCollection();
  const email = params.email.toLowerCase();
  const now = new Date();

  const existing = await col.findOne({ email });
  if (existing) {
    await col.updateOne(
      { email },
      {
        $set: {
          lastLoginAt: now,
          name: params.name || existing.name,
          ...(params.photoURL ? { photoURL: params.photoURL } : {}),
        },
      }
    );
    return { ...existing, lastLoginAt: now };
  }

  const newUser: AppUser = {
    email,
    name: params.name,
    role: 'user',
    status: 'pending',
    provider: 'google',
    photoURL: params.photoURL,
    createdAt: now,
    lastLoginAt: now,
    ...(params.consent
      ? { consent: { emailAndName: true, at: now } }
      : {}),
  };
  await col.insertOne(newUser);
  return newUser;
}

export async function listUsers(): Promise<AppUser[]> {
  const col = await getUsersCollection();
  // 관리자 먼저, 그다음 대기중, 최신 가입순
  return col.find({}).sort({ createdAt: -1 }).toArray();
}

export async function updateUserStatus(email: string, status: AppUser['status']): Promise<boolean> {
  const col = await getUsersCollection();
  const res = await col.updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        status,
        ...(status === 'approved' ? { approvedAt: new Date() } : {}),
      },
    }
  );
  return res.matchedCount > 0;
}
