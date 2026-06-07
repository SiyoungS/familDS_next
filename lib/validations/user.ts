// lib/validations/user.ts
import { z } from 'zod';

// 생성(POST)용 스키마
export const userSchema = z.object({
  name: z.string()
    .min(2, '이름은 최소 2글자 이상이어야 합니다.')
    .max(50, '이름은 50글자를 초과할 수 없습니다.'),
  email: z.email('유효한 이메일 주소를 입력해주세요.'),
  password: z.string()
    .min(8, '비밀번호는 최소 8글자 이상이어야 합니다.')
    .max(50, '비밀번호는 50글자를 초과할 수 없습니다.'),
}).strict(); 
// 💡 .strict() : 스키마에 정의되지 않은 잉여 데이터가 들어오면 에러를 발생시켜, 
// 악의적인 필드 삽입(Mass Assignment)을 방지합니다.

// 수정(PATCH)용 스키마
// .partial()을 사용하면 모든 필드가 선택적(Optional)으로 변환되어 부분 수정에 적합합니다.
export const userUpdateSchema = userSchema.partial();