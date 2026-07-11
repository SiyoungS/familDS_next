// scripts/migrate-inquiries-db.mjs
//
// `test` DB 의 inquiries 문서를 DB_NAME DB 의 inquiries 로 복사한다.
// - _id 를 유지한 채 복사한다.
// - 목적지에 같은 _id 가 이미 있으면 skip 한다.
// - 소스(test.inquiries)는 절대 삭제하지 않는다. 오직 복사만 한다.
//
// 실행 방법:
//   node scripts/migrate-inquiries-db.mjs
//
// URI/DB명 해석은 scripts/cleanup-plaintext-passwords.mjs 와 동일한 패턴을 따른다.

import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

const { loadEnvConfig } = nextEnv;

// Next.js 앱과 동일하게 .env(.local 등)를 로드한다.
loadEnvConfig(process.cwd());

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

// lib/auth/config.ts 와 동일한 DB명 해석
const DB_NAME =
  process.env.MONGODB_DB_NAME || process.env.MONGODB_PROJECT_NAME || '';
const INQUIRIES_COLLECTION =
  process.env.MONGODB_INQUIRIES_COLLECTION || 'inquiries';

async function main() {
  if (!DB_NAME) {
    throw new Error(
      '목적지 DB명이 비어 있습니다. MONGODB_DB_NAME 또는 MONGODB_PROJECT_NAME 을 확인하세요.'
    );
  }
  if (DB_NAME === 'test') {
    throw new Error('목적지 DB 가 소스(test)와 동일합니다. 마이그레이션 중단.');
  }

  const uri = buildUri();
  const client = new MongoClient(uri, {});

  await client.connect();
  try {
    const source = client.db('test').collection(INQUIRIES_COLLECTION);
    const dest = client.db(DB_NAME).collection(INQUIRIES_COLLECTION);

    console.log(
      `소스="test"."${INQUIRIES_COLLECTION}" -> 목적지="${DB_NAME}"."${INQUIRIES_COLLECTION}"`
    );

    const total = await source.countDocuments({});
    console.log(`소스 문서 총 개수: ${total}`);

    let inserted = 0;
    let skipped = 0;

    const cursor = source.find({});
    for await (const doc of cursor) {
      const exists = await dest.findOne(
        { _id: doc._id },
        { projection: { _id: 1 } }
      );
      if (exists) {
        skipped += 1;
        continue;
      }
      try {
        await dest.insertOne(doc);
        inserted += 1;
      } catch (err) {
        // duplicate key(경합 등)는 skip 으로 처리
        if (err && err.code === 11000) {
          skipped += 1;
        } else {
          throw err;
        }
      }
    }

    const destFinal = await dest.countDocuments({});

    console.log('--- 결과 ---');
    console.log(`소스 문서 총 개수: ${total}`);
    console.log(`복사(insert)한 건수: ${inserted}`);
    console.log(`skip 한 건수: ${skipped}`);
    console.log(`목적지 최종 문서 수: ${destFinal}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`오류로 종료합니다: ${message}`);
  process.exit(1);
});
