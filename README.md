# 가계도(Genogram) 생성 앱

보웬 가족체계이론(Bowen family systems theory)에 기반한 가계도 생성 웹 앱입니다. 상담 기록 텍스트를 AI로 분석해 인물·관계·정서선을 추출하고 가계도로 그려 줍니다.

## 주요 기능

- AI 추출: Google Gemini(모델 폴백 체인 `gemini-3.6-flash` -> `gemini-3.5-flash-lite` -> `gemini-2.5-flash`)와 OpenAI(`gpt-6-luna`) 중 선택. 인물 -> 관계 -> 정서선 순서의 프롬프트 체이닝
- 가계도 캔버스: 보웬 방식 정렬, 표시 옵션, 관계선 농도 조절, 인쇄
- 인증: Firebase Google 로그인 후 자체 JWT 세션 쿠키 발급. 신규 가입자는 `pending` 상태이며 관리자 승인 후 사용
- 페이지: 메인(분석), 로그인/가입/탈퇴(`/auth/*`), 마이페이지, 문의(`/inquiry`), 관리자(`/admin`), HWP 텍스트 추출(`/hwp2txt`)
- 이력(history): 생성한 가계도를 MongoDB에 저장/조회
- 프롬프트는 MongoDB `prompts` 컬렉션에서 읽고(5분 캐시), 없으면 로컬 파일로 폴백

## 기술 스택

- Next.js 16.4.2 (App Router, Turbopack), React 19.3.1, TypeScript ^5.9
- Tailwind CSS ^4.3, framer-motion ^14.3, lucide-react ^1.59
- Firebase ^13 (Google 로그인), jose ^6 (JWT), MongoDB 드라이버 ^7.7
- @google/genai ^2.30, openai ^7.36
- 패키지 매니저: pnpm, Node 24.x (`engines` 필드)

## 시작하기

```bash
pnpm install
# 프로젝트 루트에 .env(.local)를 만들고 아래 환경변수를 채운다
pnpm dev
```

### 환경변수

값은 저장소에 두지 않습니다. 이름과 용도만 적습니다.

| 이름 | 용도 |
| --- | --- |
| `MONGODB_URI` | MongoDB 접속 URI (`[MONGODB_USER_NAME]`, `[MONGODB_PASSWORD]` 자리표시자를 치환) |
| `MONGODB_USER_NAME` | URI에 채워 넣을 DB 사용자명 |
| `MONGODB_PASSWORD` | URI에 채워 넣을 DB 비밀번호 |
| `MONGODB_DB_NAME` | 사용할 DB 이름 (우선) |
| `MONGODB_PROJECT_NAME` | DB 이름 대체값 (`MONGODB_DB_NAME`이 없을 때) |
| `MONGODB_USERS_COLLECTION` | 사용자 컬렉션명 |
| `MONGODB_HISTORY_COLLECTION` | 이력 컬렉션명 |
| `MONGODB_INQUIRIES_COLLECTION` | 문의 컬렉션명 (기본 `inquiries`) |
| `MONGODB_PROMPTS_COLLECTION` | 프롬프트 컬렉션명 (기본 `prompts`) |
| `JWT_SECRET` | 세션 JWT 서명 비밀키 |
| `JWT_USER_TTL_HOURS` | 일반 사용자 세션 유효 시간 (기본 1) |
| `JWT_ADMIN_TTL_HOURS` | 관리자 세션 유효 시간 (기본 12) |
| `GEMINI_API_KEY` | Gemini API 키 |
| `OPENAI_API_KEY` | OpenAI API 키 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase 웹 API 키 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase 인증 도메인 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID (서버의 토큰 검증에도 사용) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase 스토리지 버킷 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase 메시징 발신자 ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase 앱 ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase 측정 ID |
| `PROMPT_FILE_PATH` | (폴백/시드) 메인 프롬프트 파일 경로 |
| `PROMPT_TYPE_INTERFACE_FILE_PATH` | (폴백/시드) 출력 인터페이스 프롬프트 파일 경로 |
| `PROMPT_RELATIONS_FILE_PATH` | (폴백/시드) 관계 추출 프롬프트 파일 경로 |
| `PROMPT_EMOTIONS_FILE_PATH` | (폴백/시드) 정서선 추출 프롬프트 파일 경로 |
| `TEST_ENV` | `/api/mock-genogram`의 테스트 모드 선택 |

`NODE_ENV`는 Next.js가 설정하며 프로덕션에서 세션 쿠키에 `secure`를 켜는 데 쓰입니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 빌드 결과 실행 |
| `pnpm lint` | ESLint |

## `scripts/` 운영 스크립트

모두 `.env`를 Next.js와 같은 방식으로 읽어 MongoDB에 접속합니다. 프로젝트 루트에서 `node`로 실행합니다.

- `seed-prompts.mjs`: `lib/`의 프롬프트 텍스트 파일 4개(contents, interface, relations, emotions)를 읽어 `prompts` 컬렉션에 key별로 upsert합니다. 실행: `node scripts/seed-prompts.mjs` (드라이런 옵션 없음, 바로 쓰기)
- `migrate-inquiries-db.mjs`: 기본 `test` DB의 `inquiries` 문서를 설정된 DB로 복사합니다. `_id`를 유지하고 이미 있으면 건너뛰며, 원본은 삭제하지 않습니다. 실행: `node scripts/migrate-inquiries-db.mjs` (드라이런 옵션 없음)
- `cleanup-plaintext-passwords.mjs`: 사용자 문서에 남은 평문 `password` 필드를 정리합니다. 기본은 드라이런(건수와 email만 출력, 값은 출력 안 함), `--apply`를 붙이면 실제로 `$unset`합니다.
  - `node scripts/cleanup-plaintext-passwords.mjs` (드라이런)
  - `node scripts/cleanup-plaintext-passwords.mjs --apply`

> 주의: `migrate-inquiries-db.mjs`와 `cleanup-plaintext-passwords.mjs`가 운영 DB에 적용되었는지는 확인되지 않았습니다. 먼저 운영 DB 기준 드라이런(`cleanup-plaintext-passwords.mjs`는 `--apply` 없이)으로 상태를 확인한 뒤 실행 여부를 결정하세요. `migrate-inquiries-db.mjs`는 드라이런이 없으므로 대상 DB를 확인하고 실행하세요.

## 프로젝트 구조

- `app/`: 페이지와 API 라우트 (`api/generate`, `api/history`, `api/inquiries`, `api/auth`, `api/admin`, `api/hwp2txt` 등), `(genograms)/`에 캔버스·모달, `providers/`에 인증·이력 컨텍스트
- `components/`: 분석 화면, 이력 패널, 플로팅 계정 컨트롤 등 공용 UI
- `lib/`: `auth/`(JWT 세션, Firebase 토큰 검증), `db/`(users/history/inquiries/prompts), `genograms/`(보웬 정렬 등 가계도 로직), `hwp/`, `prompt-loader.ts`, `mongodb.ts`
- `types/`: 공용 타입
- `proxy.ts`: 인증 가드 (`/`, `/admin/*` 대상). 관리자 경로는 관리자 권한을 검사
- `scripts/`: 운영용 일회성 스크립트

## 유지보수

점검 내역과 남은 작업은 [`docs/maintenance-backlog.md`](docs/maintenance-backlog.md)를 참고하세요.
