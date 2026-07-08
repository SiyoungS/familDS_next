// scripts/cleanup-plaintext-passwords.mjs
//
// 사용자 문서에 잔존하는 평문 `password` 필드를 조회/정리하는 스크립트.
//
// 실행 방법:
//   node scripts/cleanup-plaintext-passwords.mjs           # 드라이런(읽기 전용, 기본값)
//   node scripts/cleanup-plaintext-passwords.mjs --apply   # 실제 정리($unset password)
//
// - 드라이런: password 필드가 존재하는 문서 수와 email 목록만 출력한다.
//   (비밀번호 값 자체는 절대 출력하지 않는다.)
// - --apply: { password: { $exists: true } } 문서에서 password 필드를 $unset 하고
//   modifiedCount 를 출력한다.
//
// URI/DB명/컬렉션명은 lib/mongodb.ts, lib/auth/config.ts 와 동일한 환경변수를 사용한다.

import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

const { loadEnvConfig } = nextEnv;

// Next.js 앱과 동일하게 .env(.local 등)를 로드한다.
loadEnvConfig(process.cwd());

const APPLY = process.argv.includes('--apply');

// lib/mongodb.ts 와 동일한 URI 구성 로직
function buildUri() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error('환경변수 MONGODB_URI 가 설정되어 있지 않습니다. (.env 확인)');
  }
  const userName = process.env.MONGODB_USER_NAME;
  const password = process.env.MONGODB_PASSWORD;
  return rawUri
    .replace('[MONGODB_USER_NAME]', encodeURIComponent(userName ?? ''))
    .replace('[MONGODB_PASSWORD]', encodeURIComponent(password ?? ''));
}

// lib/auth/config.ts 와 동일한 DB명/컬렉션명 해석
const DB_NAME =
  process.env.MONGODB_DB_NAME || process.env.MONGODB_PROJECT_NAME || '';
const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION || 'users';

const FILTER = { password: { $exists: true } };

async function main() {
  const uri = buildUri();
  const client = new MongoClient(uri, {});

  await client.connect();
  try {
    const collection = client.db(DB_NAME).collection(USERS_COLLECTION);

    const count = await collection.countDocuments(FILTER);
    console.log(
      `[${APPLY ? 'APPLY' : 'DRY-RUN'}] DB="${DB_NAME || '(default)'}" collection="${USERS_COLLECTION}"`
    );
    console.log(`평문 password 필드가 남은 사용자 문서 수: ${count}`);

    if (count > 0) {
      // email 만 조회(비밀번호 값은 절대 출력하지 않음)
      const docs = await collection
        .find(FILTER, { projection: { email: 1, _id: 0 } })
        .toArray();
      const emails = docs.map((d) => d.email ?? '(email 없음)');
      console.log('대상 문서 email 목록:');
      for (const email of emails) {
        console.log(`  - ${email}`);
      }
    }

    if (APPLY) {
      const result = await collection.updateMany(FILTER, {
        $unset: { password: '' },
      });
      console.log(`정리 완료. modifiedCount: ${result.modifiedCount}`);
    } else {
      console.log(
        '드라이런 모드입니다. 실제 정리를 하려면 --apply 인자를 붙여 다시 실행하세요.'
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`오류로 종료합니다: ${message}`);
  process.exit(1);
});
