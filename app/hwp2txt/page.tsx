'use client';

import { useRef, useState } from 'react';

export default function Hwp2TxtPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleFile = async (file: File) => {
    setError('');
    setText('');
    setCopied(false);

    if (!file.name.toLowerCase().endsWith('.hwp')) {
      setError('.hwp 확장자 파일만 업로드할 수 있습니다.');
      return;
    }

    setFileName(file.name);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/hwp2txt', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '텍스트 추출에 실패했습니다.');
      setText(data.text ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '텍스트 추출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] px-4 py-10 font-sans">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827]">HWP 텍스트 추출기</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            한글(.hwp) 파일을 올리면 본문 텍스트만 읽어옵니다. (HWP 5.x 형식 지원)
          </p>
        </header>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragOver
              ? 'border-[#10b981] bg-[#ecfdf5]'
              : 'border-[#d1d5db] bg-white hover:border-[#10b981]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".hwp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <span className="text-3xl">📄</span>
          <span className="mt-3 text-sm font-semibold text-[#111827]">
            클릭하거나 .hwp 파일을 끌어다 놓으세요
          </span>
          {fileName && <span className="mt-2 text-xs text-[#6b7280]">{fileName}</span>}
        </label>

        {loading && (
          <p className="mt-4 text-sm text-[#6b7280]">텍스트를 추출하는 중입니다...</p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {text && !loading && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-[#6b7280]">
                {text.length.toLocaleString()}자
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-xl border border-[#d1d5db] bg-white px-4 py-1.5 text-sm font-semibold text-[#111827] transition hover:border-[#10b981] hover:text-[#10b981]"
              >
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
            <textarea
              readOnly
              value={text}
              className="h-[28rem] w-full resize-y rounded-2xl border border-[#e5e7eb] bg-white p-4 text-sm leading-relaxed text-[#111827] focus:border-[#10b981] focus:outline-none"
            />
          </section>
        )}
      </div>
    </div>
  );
}
