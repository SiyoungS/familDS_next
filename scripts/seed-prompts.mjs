// scripts/seed-prompts.mjs
//
// lib/의 프롬프트 txt 파일 4개를 읽어 prompts 컬렉션에 key별로 upsert 한다.
//
// 실행 방법:
//   node scripts/seed-prompts.mjs
//
// URI/DB명 해석은 scripts/cleanup-plaintext-passwords.mjs 와 동일한 패턴을 따른다.

import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';

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
const PROMPTS_COLLECTION = process.env.MONGODB_PROMPTS_COLLECTION || 'prompts';

// key -> 파일 경로 매핑 (env 우선, 없으면 lib/의 기본 경로)
const PROMPT_FILES = [
  {
    key: 'contents',
    filePath:
      process.env.PROMPT_FILE_PATH ||
      path.join(process.cwd(), 'lib', 'prompt-contents.env.txt'),
  },
  {
    key: 'interface',
    filePath:
      process.env.PROMPT_TYPE_INTERFACE_FILE_PATH ||
      path.join(process.cwd(), 'lib', 'prompt-interface.env.txt'),
  },
  {
    key: 'relations',
    filePath:
      process.env.PROMPT_RELATIONS_FILE_PATH ||
      path.join(process.cwd(), 'lib', 'prompt-relations.env.txt'),
  },
  {
    key: 'emotions',
    filePath:
      process.env.PROMPT_EMOTIONS_FILE_PATH ||
      path.join(process.cwd(), 'lib', 'prompt-emotions.env.txt'),
  },
];

async function main() {
  const uri = buildUri();
  const client = new MongoClient(uri, {});

  await client.connect();
  try {
    const collection = client.db(DB_NAME).collection(PROMPTS_COLLECTION);

    console.log(
      `DB="${DB_NAME || '(default)'}" collection="${PROMPTS_COLLECTION}"`
    );

    // key unique 인덱스 생성
    await collection.createIndex({ key: 1 }, { unique: true });
    console.log('인덱스 생성 완료: { key: 1 } unique');

    for (const { key, filePath } of PROMPT_FILES) {
      const text = fs.readFileSync(filePath, 'utf8');
      const result = await collection.updateOne(
        { key },
        { $set: { key, text, updatedAt: new Date() } },
        { upsert: true }
      );
      const upsertedId = result.upsertedId ? String(result.upsertedId) : null;
      console.log(
        `upsert key="${key}" file="${filePath}" ` +
          `matchedCount=${result.matchedCount} ` +
          `modifiedCount=${result.modifiedCount} ` +
          `upsertedId=${upsertedId ?? '(none, 기존 문서 갱신)'}`
      );
    }

    // 검증: 각 key 재조회 후 text 길이 출력
    console.log('--- 검증(재조회) ---');
    for (const { key } of PROMPT_FILES) {
      const doc = await collection.findOne({ key });
      if (!doc) {
        console.log(`key="${key}" -> 문서를 찾지 못함(FAIL)`);
      } else {
        console.log(
          `key="${key}" -> text 길이=${doc.text?.length ?? 0}자 ` +
            `updatedAt=${doc.updatedAt?.toISOString?.() ?? doc.updatedAt}`
        );
      }
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
