// lib/mongodb.ts
import { MongoClient, ServerApiVersion } from 'mongodb';

if (!process.env.MONGODB_URI || !process.env.MONGODB_USER_NAME || !process.env.MONGODB_PASSWORD) {
  throw new Error('.env.local 파일에 MONGODB_URI, MONGODB_USER_NAME, MONGODB_PASSWORD를 설정해주세요.');
}

// 자격 증명은 URL 예약 문자가 있어도 안전하도록 encodeURIComponent로 치환한다.
// (위에서 env 검증을 이미 마쳤으므로 non-null 단언을 사용해도 안전하다)
const uri = process.env.MONGODB_URI
  .replace('[MONGODB_USER_NAME]', encodeURIComponent(process.env.MONGODB_USER_NAME!))
  .replace('[MONGODB_PASSWORD]', encodeURIComponent(process.env.MONGODB_PASSWORD!));

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
};

// dev/prod 모두 global 싱글톤 하나만 재사용한다.
// (prod에서 매 모듈 평가마다 새 MongoClient를 만들면 인스턴스마다 별도 연결
//  풀을 열어 Vercel 서버리스에서 Atlas 연결이 고갈된다. 그래서 dev/prod 구분
//  없이 항상 global에 캐시한 단일 연결 Promise를 공유한다)
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const makeClientPromise = (): Promise<MongoClient> => {
  const client = new MongoClient(uri, options);
  const p = client.connect();
  // 연결 실패 시 캐시를 비워 다음 요청에서 새로 시도하도록 한다
  p.catch((err) => {
    console.error('[mongodb] connection failed, clearing cache for retry:', err.message);
    if (globalWithMongo._mongoClientPromise === p) {
      globalWithMongo._mongoClientPromise = undefined;
    }
  });
  return p;
};

if (!globalWithMongo._mongoClientPromise) {
  globalWithMongo._mongoClientPromise = makeClientPromise();
}

const clientPromise: Promise<MongoClient> = globalWithMongo._mongoClientPromise;

// 애플리케이션 전체에서 단일 Promise를 공유합니다.
export default clientPromise;
