// 히스토리 컬렉션 접근 (session email 소유 스코프)

import { Collection, ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { DB_NAME, HISTORY_COLLECTION } from '@/lib/auth/config';
import type { BWGenogramData } from '@/types/bowengenogram.types';
import type { SavedHistory } from '@/types/history';

interface HistoryDoc {
  ownerEmail: string;      // 소유자(본인만 조회/삭제)
  counselTarget: string;
  counselText: string;
  raw: BWGenogramData;     // 가공 전 데이터
  createdAt: Date;
}

async function getCollection(): Promise<Collection<HistoryDoc>> {
  const client = await clientPromise;
  return client.db(DB_NAME).collection<HistoryDoc>(HISTORY_COLLECTION);
}

export async function saveHistory(params: {
  ownerEmail: string;
  counselTarget: string;
  counselText: string;
  raw: BWGenogramData;
  createdAt?: Date;
}): Promise<string> {
  const col = await getCollection();
  const res = await col.insertOne({
    ownerEmail: params.ownerEmail.toLowerCase(),
    counselTarget: params.counselTarget,
    counselText: params.counselText,
    raw: params.raw,
    createdAt: params.createdAt ?? new Date(),
  });
  return res.insertedId.toString();
}

export async function listHistory(ownerEmail: string): Promise<SavedHistory[]> {
  const col = await getCollection();
  const docs = await col
    .find({ ownerEmail: ownerEmail.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => ({
    dbId: d._id.toString(),
    counselTarget: d.counselTarget,
    counselText: d.counselText,
    raw: d.raw,
    createdAt: (d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt)).toISOString(),
  }));
}

// 본인 소유 항목만 삭제 (다른 사용자 항목은 삭제 안 됨)
export async function deleteHistory(ownerEmail: string, dbId: string): Promise<boolean> {
  if (!ObjectId.isValid(dbId)) return false;
  const col = await getCollection();
  const res = await col.deleteOne({
    _id: new ObjectId(dbId),
    ownerEmail: ownerEmail.toLowerCase(),
  });
  return res.deletedCount > 0;
}
