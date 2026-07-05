import type { ObjectId } from 'mongodb';

export type InquiryStatus = 'open' | 'answered' | 'deleted';

export interface InquiryAttachment {
  name: string;
  mime: string;
  dataUrl: string;
}

export interface AppInquiry {
  _id?: ObjectId | string;
  subject: string;
  message: string;
  authorEmail: string;
  authorName: string;
  authorRole: 'admin' | 'user';
  createdAt: Date;
  status: InquiryStatus;
  reply?: string;
  repliedAt?: Date;
  repliedBy?: string;
  attachments?: InquiryAttachment[];
}

export interface PublicInquiry {
  id: string;
  subject: string;
  message: string;
  authorName: string;
  authorRole: 'admin' | 'user';
  createdAt: string;
  status: InquiryStatus;
  reply?: string;
  repliedAt?: string;
  repliedBy?: string;
  attachments?: InquiryAttachment[];
}
