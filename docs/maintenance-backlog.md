# 유지보수 백로그 (2026-10-17 점검)

다른 세션에서 이어서 작업할 수 있도록 남기는 체크리스트입니다.
**위에서부터 순서대로** 진행하고, 완료한 항목은 `[x]`로 바꾸고 필요하면 `> 메모:` 줄을 덧붙입니다.
각 단계가 끝나면 `pnpm build`와 `npx tsc --noEmit`가 통과해야 다음 단계로 넘어갑니다.

점검 당시 기준선:
- `npx tsc --noEmit`: 통과
- `pnpm lint`: 38건 (오류 21, 경고 17)
- `pnpm audit`: 71건 (심각 3, 높음 40, 보통 23, 낮음 5)

---

## 1. 보안 업데이트 (최우선)

- [x] `next` 16.2.4 → 16.4.2 (최소 16.3.8). 심각: Middleware/Proxy 우회. 인증 가드가 `proxy.ts`에 있으므로 가장 시급
- [x] `eslint-config-next`, `@next/env`를 next와 같은 버전으로 맞추기
- [x] `tailwindcss`, `@tailwindcss/postcss` 4.2 → 4.3.x (postcss·nanoid·source-map-js 하위 취약점)
- [x] firebase 하위 의존성(`@grpc/grpc-js` ≥1.13.6, `protobufjs` ≥7.6.3) 해결: firebase 12.x 최신 패치 또는 `pnpm update`
  > 메모: firebase는 12.19.0으로 올렸고, `@grpc/grpc-js`가 `~1.9`로 고정되어 있어 `pnpm-workspace.yaml`의 `overrides`에 `'@grpc/grpc-js': '>=1.13.6 <2'`를 추가해 1.14.6으로 해결했습니다.
- [x] eslint 계열 하위 취약점(brace-expansion, js-yaml, braces, browserslist, @babel/core 등): `pnpm update`로 해결, 남으면 `pnpm.overrides` 검토
  > 메모: `pnpm update`로 대부분 해결. `braces` 3.0.3(eslint-config-next > fast-glob > micromatch 경로, dev 전용)만 남았고 패치 버전이 아직 없어 override 불가.
- [x] `pnpm audit` 재실행 후 남은 항목과 사유를 여기에 메모
  > 메모: 재실행 결과 71건 → 1건 (높음 1, 나머지 0). 남은 1건은 `braces` <=3.0.3 (GHSA-vfj7-8cjw-p6xm, dev 전용 경로), 패치 버전이 없어 보류. 업스트림 패치 후 재확인.

## 2. 마이너/패치 업데이트

- [x] `react`, `react-dom` 19.2.4 → 19.3.x (+ `@types/react`, `@types/react-dom` 19.3.x)
  > 메모: react/react-dom 19.3.1(정확히 고정), @types 19.3.0.
- [x] `@google/genai` 2.13 → 2.30 (Gemini 폴백 체인 `app/api/generate/genai-client.ts` 동작 확인)
- [x] `mongodb` 7.2 → 7.7
- [x] `jose` 6.2.3 → 6.2.x 최신
- [x] `lucide-react` 1.23 → 1.59 (아이콘 이름 변경·삭제 여부 확인)
- [x] `zod` 4.4 → 4.6 (5번에서 제거할 예정이면 생략)

## 3. 린트 오류 정리 (`pnpm lint` 0 오류 목표)

- [x] `react-hooks/set-state-in-effect` 7건: `app/(genograms)/GenogramModal.tsx:19`, `app/admin/page.tsx:66`, `app/inquiry/page.tsx:74,87`, `app/providers/HistoryProvider.tsx:36`, `components/FloatingAccountControls.tsx:53,67`
  > 메모: `HistoryProvider.tsx`(sessionStorage 복원, 하이드레이션 불일치 방지)와 `admin/page.tsx`(마운트 시 API 조회, setState는 await 이후라 오탐)는 사유를 적은 `eslint-disable-next-line`로 유지. 나머지는 렌더 중 상태 리셋·파생값·`useSyncExternalStore`로 해결
- [x] `@typescript-eslint/no-explicit-any` 11건: `app/api/generate/route.ts`(8), `app/api/generate/genai-client.ts:60`, `app/(genograms)/GenogramCanvas.tsx:840`, `types/genogram.types.ts:23`
- [x] `prefer-const` 2건: `app/(genograms)/GenogramCanvas.tsx:864,869`
- [x] `react/no-children-prop` 1건: `app/page.tsx:149`
- [x] `react-hooks/exhaustive-deps` 1건: `app/(genograms)/GenogramModal.tsx:54`
  > 메모: show 변경 시에만 실행하려는 의도라 사유 주석과 함께 `eslint-disable-next-line react-hooks/exhaustive-deps`
- [x] 미사용 변수·import 13건 (경고)
  > 메모: `GenogramCanvasOld.tsx:46` 경고 1건만 남음 (5단계에서 파일 삭제 예정)
- [x] `@next/next/no-img-element` 3건: `app/inquiry/page.tsx:317,419,557` (사용자 업로드 이미지라면 의도된 `<img>`일 수 있으므로 판단 후 eslint-disable 사유 주석도 가능)
  > 메모: 이미지가 사용자 업로드 data URL이라 `<img>` 유지 + 사유 주석 `eslint-disable-next-line` 3건

## 4. 메이저 업데이트 (한 패키지씩, 각각 빌드 확인)

- [x] `firebase` 12 → 13
  > 메모: 13.0.0. 파괴적 변경은 AI 모듈(@firebase/ai 3.0)뿐이고 이 프로젝트는 app/auth만 사용(`lib/firebase.ts`, `lib/firebase/client.ts`)해서 코드 변경 없음. firebase 13도 여전히 `@grpc/grpc-js` 1.9.16을 고정하므로 `pnpm-workspace.yaml`의 override는 제거하지 않고 유지(제거 시 audit 3건으로 회귀 확인).
- [x] `framer-motion` 12 → 14 (`motion` 패키지로 이름이 바뀌었는지 확인)
  > 메모: 14.3.0. 공식 업그레이드 가이드상 13·14 모두 JS 파괴적 변경 없음, framer-motion은 deprecated 아님(`motion` 패키지는 병행 배포)이라 패키지명은 그대로 두고 버전만 올림.
- [x] `openai` 6 → 7 (5번에서 OpenAI 경로를 제거하기로 하면 생략)
- [ ] `eslint` 9 → 10 (`eslint-config-next` 호환 여부 먼저 확인, 호환되지 않으면 보류)
  > 메모: 보류. eslint-config-next 16.4.2 자체는 peer `eslint >=9`이나 하위 플러그인 `eslint-plugin-react` 7.37.5(^9.7까지), `eslint-plugin-jsx-a11y` 6.10.2(^9까지), `eslint-plugin-import` 2.32.0(^9까지)이 eslint 10 peer를 선언하지 않음. 9.39.5 유지.
- [ ] `typescript` 5 → 7 (Next.js 지원 여부 먼저 확인, 지원되지 않으면 5.x 최신 유지)
  > 메모: 보류, 5.9.3(5.x 최신) 유지. Next 16.3+의 TS7 지원은 `tsc` CLI를 쓰는 실험 기능으로 문서에 프로덕션 비권장이며, `typescript-eslint` 8.58.2의 typescript peer가 `<6.1.0`이라 린트도 깨짐.
- [x] `@types/node` ^20 → 배포 런타임(Vercel Node 버전)에 맞추기
  > 메모: Vercel 기본값이 Node 24.x(22.x도 지원, 20은 2026-10-01 지원 종료)라 `@types/node` 24.19.2로 올리고 `package.json`에 `"engines": { "node": "24.x" }` 추가. 로컬도 Node 24.

## 5. 정리

- [x] `app/(genograms)/GenogramCanvasOld.tsx` 삭제 (import하는 곳 없음)
  > 메모: 저장소 전체 grep으로 참조 없음 확인 후 삭제. 린트 0건.
- [x] `zod` 의존성 제거 (import하는 곳 없음)
  > 메모: 소스·설정 전체에서 `zod` import 없음 확인 후 `pnpm remove zod`.
- [x] OpenAI 경로(`app/api/generate/openai-route.ts`) 유지 + 모델 갱신 (현재 `gpt-4o-2024-11-20` → 최신 모델). 4단계의 openai 7 업그레이드와 함께 진행
  > 메모: 2026-10-17 사용자 결정은 "유지 + 모델 갱신"
  > 메모: openai 7.36.0, 모델 `gpt-6-luna`로 변경(OpenAI 폐기 안내에서 gpt-4o-2024-11-20(2027-01-14 종료)의 공식 대체 모델, https://developers.openai.com/api/docs/guides/deprecations 및 /api/docs/models/gpt-6-luna). Chat Completions·structured outputs 지원, 스냅샷은 별칭 하나뿐. temperature는 reasoning_effort가 "none"일 때만 허용되므로 `reasoning_effort: "none"`을 추가해 `temperature: 0`을 유지. 품질이 부족하면 `gpt-6.1-sol`(effort none 불가, temperature 제거 + `reasoning_effort: "low"` 필요)을 검토. 실제 호출 검증은 안 함.
- [x] Turbopack 빌드 경고 확인: `lib/prompt-loader.ts:22`의 동적 파일시스템 접근(`path.join(process.cwd(), ...)`). 프롬프트를 MongoDB로 옮겼으므로 남은 파일 로딩이 아직 필요한지 검토
  > 메모: 삭제하지 않고 유지. `getSystemPrompt_bowen` 등이 `loadPromptPart`로 호출하며, DB에 key가 없거나 DB 조회가 실패(`getPromptText`가 null 반환)할 때 쓰는 실사용 폴백이고 `.gitignore`된 `*prompt*.env*.txt` 파일을 읽는 동작이라 보존. `path.join(/*turbopackIgnore: true*/ process.cwd(), ...)` 주석(Next 문서 08-turbopack.md의 magic comment)으로 경고만 제거했고 빌드에서 경고 0건 확인. MongoDB 로딩 경로는 변경 없음.
- [x] README를 프로젝트에 맞게 다시 쓰기: 개요, 환경변수 목록(값 제외), MongoDB/Firebase/Gemini 설정, `scripts/` 사용법
- [ ] **보류 (사용자 확인 필요):** `scripts/cleanup-plaintext-passwords.mjs`, `scripts/migrate-inquiries-db.mjs`의 운영 DB 적용 여부를 모름. 그대로 두고, 운영 DB에서 드라이런(`node scripts/cleanup-plaintext-passwords.mjs`)으로 확인한 뒤 결정
  > 메모: 2026-10-17 사용자 답변은 "아직 미적용/모름". README에 두 스크립트의 용도와 실행법을 적어 둘 것 (README 작성 완료, 스크립트 항목 자체는 보류 유지)

## 진행 현황 요약

### (a) 아직 열려 있는 항목
- `braces` 3.0.3 권고(dev 전용 경로): 업스트림 패치 버전이 아직 없음. 패치 후 `pnpm audit` 재확인
- `eslint` 10: 하위 플러그인 peer 미지원으로 보류, 나중에 재확인
- `typescript` 7: Next.js/typescript-eslint 미지원으로 보류, 나중에 재확인
- `scripts/` 처리 결정(보관/삭제): 운영 DB 적용 여부 확인 후 사용자 결정 대기
- **[보류: 다른 개발 완료 후 처리]** 서버 디버깅 로그의 민감정보 노출: `/api/generate` 경로의 `console.log`(`Raw response from Gemini`, `data:`, `levelGroups`, `displayOrders` 등)가 상담 내용에서 추출한 인물명·질환·사망원인·약물/학대 여부를 그대로 출력함. 운영(Vercel 함수 로그)에서는 끄거나 개발 환경 전용으로 제한할 것 (2026-10-18 런타임 점검 중 발견)

### (b) 사람이 직접 확인해야 하는 런타임 점검

> 실행 순서·확인 위치는 **`docs/runtime-checklist.md`** 참고 (AI 모델 점검은 `node scripts/check-ai-models.mjs`). Firestore/grpc 항목은 Firestore 미사용으로 점검 불필요.

- Google 로그인과 토큰 교환 (firebase 13)
- framer-motion 애니메이션 (14)
- OpenAI 실호출 1회: `gpt-6-luna` + `response_format: json_object` + `reasoning_effort: none` + `temperature: 0`
- Gemini 폴백 체인 (3.6-flash -> 3.5-flash-lite -> 2.5-flash)
- Firestore/grpc override(`@grpc/grpc-js` 1.14.x) 동작
- Vercel 프로젝트의 Node 버전 설정이 24.x인지
- 린트 수정으로 바뀐 UI 동작:
  - FloatingAccountControls: 브레이크포인트 및 전체화면에서의 접힘
  - 가계도 모달: 다시 열 때 상태 초기화
  - 문의 페이지: 글자 수 카운터와 페이지 리셋
  - HistoryProvider: 새로고침 후 복원
  - 관리자 목록: 로딩 상태 표시
