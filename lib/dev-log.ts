// 로컬 개발(pnpm dev) 전용 로그 함수. 상담 내용·인물명·AI 응답 등 민감정보 출력용.
// NODE_ENV가 'development'일 때만 출력하고, 운영(Vercel)·테스트·빌드에서는 아무것도 하지 않는다.
// 서버(route handler)와 클라이언트 컴포넌트 모두에서 import 가능.
const isDev = process.env.NODE_ENV === 'development';

export function devLog(...args: unknown[]): void {
  if (isDev) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (isDev) console.warn(...args);
}

export function devError(...args: unknown[]): void {
  if (isDev) console.error(...args);
}
