import { ObjectId } from 'mongodb';
import clientPromise from '../mongodb';
import { DB_NAME, INQUIRIES_COLLECTION } from '../auth/config';
import type { AppInquiry } from '@/types/inquiry';

export async function getInquiryCollection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection<AppInquiry>(INQUIRIES_COLLECTION);
}

export async function createInquiry(inquiry: Omit<AppInquiry, 'createdAt' | 'status'>) {
  const collection = await getInquiryCollection();
  const doc = {
    ...inquiry,
    createdAt: new Date(),
    status: 'open' as const,
  };
  const result = await collection.insertOne(doc);
  return result.insertedId;
}

export async function listUserInquiries(email: string) {
  const collection = await getInquiryCollection();
  return collection
    .find({ authorEmail: email, status: { $ne: 'deleted' } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function listAllInquiries() {
  const collection = await getInquiryCollection();
  return collection.find({ status: { $ne: 'deleted' } }).sort({ createdAt: -1 }).toArray();
}

export async function updateInquiryReply(id: string, reply: string, repliedBy: string) {
  const collection = await getInquiryCollection();
  return collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        reply,
        repliedAt: new Date(),
        repliedBy,
        status: 'answered' as const,
      },
    },
  );
}

export async function deleteInquiry(id: string) {
  const collection = await getInquiryCollection();
  return collection.deleteOne({ _id: new ObjectId(id) });
}
