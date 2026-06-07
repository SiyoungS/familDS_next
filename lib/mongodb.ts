// lib/mongodb.ts
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('.env.local 파일에 MONGODB_URI를 설정해주세요.');
}

const userName = process.env.MONGODB_USER_NAME;
const password = process.env.MONGODB_PASSWORD;
const uri = process.env.MONGODB_URI
  .replace('[MONGODB_USER_NAME]', encodeURIComponent(userName!))
  .replace('[MONGODB_PASSWORD]', encodeURIComponent(password!));

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // 개발 모드에서는 global 객체를 사용하여 연결을 유지합니다.
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // 프로덕션 모드에서는 global 객체를 사용하지 않고 매번 새 연결을 생성합니다.
  // (서버리스 환경에서는 연결을 재사용하기 위해 컨테이너 상태를 유지합니다)
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// 애플리케이션 전체에서 단일 Promise를 공유합니다.
export default clientPromise;