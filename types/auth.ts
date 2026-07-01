// 인증/권한 관련 타입

export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'approved' | 'rejected';

// DB에 저장되는 사용자 문서
export interface AppUser {
  email: string;              // 소문자 정규화, 고유
  name: string;
  role: UserRole;             // admin은 DB에서 직접 지정
  status: UserStatus;         // 최초 가입 시 'pending'
  provider: 'google';
  photoURL?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  approvedAt?: Date;
  // 회원가입 시 개인정보(email/이름) 이용 동의 기록
  consent?: {
    emailAndName: boolean;
    at: Date;
  };
}

// 클라이언트로 내려주는 안전한 사용자 정보
export interface PublicUser {
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  photoURL?: string;
}

// 세션 JWT payload
export interface SessionPayload {
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
}
