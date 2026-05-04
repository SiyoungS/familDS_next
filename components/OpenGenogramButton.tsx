'use client';
import { useRouter } from 'next/navigation';

export default function OpenGenogramButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.push('?showGenogram=true')}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
    >
      가계도 보기 (Test)
    </button>
  );
}