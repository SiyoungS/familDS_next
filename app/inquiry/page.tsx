'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import FloatingAccountControls from '@/components/FloatingAccountControls';
import type { InquiryAttachment, PublicInquiry } from '@/types/inquiry';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function readFileAsDataUrl(file: File): Promise<InquiryAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('파일을 읽을 수 없습니다.'));
        return;
      }
      resolve({ name: file.name, mime: file.type, dataUrl: reader.result });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function InquiryPage() {
  const router = useRouter();
  const { isAuthenticated, loading, isAdmin, logout } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<InquiryAttachment[]>([]);
  const [inquiries, setInquiries] = useState<PublicInquiry[]>([]);
  const [replyText, setReplyText] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string>('');
  const [loadingState, setLoadingState] = useState(false);
  const [notification, setNotification] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const standardLabel = useMemo(() => (isAdmin ? '관리자 문의 관리' : '문의하기'), [isAdmin]);

  const totalPages = Math.max(1, Math.ceil(inquiries.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedInquiries = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return inquiries.slice(startIndex, startIndex + pageSize);
  }, [inquiries, pageSize, safeCurrentPage]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      loadInquiries();
    }
  }, [loading, isAuthenticated]);

  // keep charCount synced if message changes from elsewhere
  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  useEffect(() => {
    setCurrentPage(1);
  }, [inquiries.length, pageSize]);

  async function loadInquiries() {
    setLoadingState(true);
    setFetchError('');
    try {
      const res = await fetch('/api/inquiries');
      if (!res.ok) throw new Error('문의 목록을 불러오는 중 오류가 발생했습니다.');
      const data: PublicInquiry[] = await res.json();
      setInquiries(data);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : '알 수 없는 오류');
    } finally {
      setLoadingState(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setNotification('제목과 내용을 모두 입력해주세요.');
      return;
    }
    if (message.length > 1000) {
      setNotification('문의 내용은 최대 1000자까지 입력할 수 있습니다.');
      return;
    }
    setLoadingState(true);
    setNotification('');
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, attachments }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || '문의 저장에 실패했습니다.');
      }
      setSubject('');
      setMessage('');
      setCharCount(0);
      setAttachments([]);
      setNotification('문의가 정상적으로 접수되었습니다.');
      await loadInquiries();
    } catch (error) {
      setNotification(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoadingState(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;
    setLoadingState(true);
    try {
      const loaded = await Promise.all(Array.from(files).map(readFileAsDataUrl));
      setAttachments((prev) => [...prev, ...loaded]);
    } catch (error) {
      setNotification(error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setLoadingState(false);
      event.target.value = '';
    }
  }

  // prevent user from injecting attachments via manual input - only allow file picker flow
  function handlePasteOnAttachments(e: React.ClipboardEvent) {
    // noop: attachments are only added via file input; ignore pasted content
    e.preventDefault();
  }

  async function handleDeleteAttachment(name: string) {
    setAttachments((prev) => prev.filter((item) => item.name !== name));
  }

  async function handleReply(id: string) {
    if (!replyText.trim()) {
      setNotification('답변 내용을 입력해주세요.');
      return;
    }
    setLoadingState(true);
    try {
      const response = await fetch(`/api/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || '답변 저장에 실패했습니다.');
      }
      setReplyText('');
      setActiveReplyId('');
      setNotification('답변이 저장되었습니다.');
      await loadInquiries();
    } catch (error) {
      setNotification(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoadingState(false);
    }
  }

  async function handleDeleteInquiry(id: string) {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    setLoadingState(true);
    try {
      const response = await fetch(`/api/inquiries/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || '삭제에 실패했습니다.');
      }
      setNotification('문의가 삭제되었습니다.');
      await loadInquiries();
    } catch (error) {
      setNotification(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoadingState(false);
    }
  }

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb] text-gray-500">
        <p className="text-sm">인증 상태를 확인 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] px-4 py-8 font-sans">
      <FloatingAccountControls
        position="fixed"
        collapseBelow={1024}
        items={[
          { key: 'home', label: '홈', onClick: () => router.push('/') },
          { key: 'mypage', label: '마이페이지', onClick: () => router.push('/mypage') },
          ...(isAdmin ? [{ key: 'admin', label: '관리자', onClick: () => router.push('/admin') }] : []),
          { key: 'logout', label: '로그아웃', emphasized: true, onClick: async () => { await logout(); router.push('/auth/login'); } },
        ]}
      />
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between pr-14 lg:pr-40">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">{standardLabel}</h1>
            <p className="mt-1 text-sm text-gray-500">문의는 관리자에게만 공개됩니다.</p>
          </div>
        </header>

        {fetchError ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{fetchError}</p>
        ) : null}
        {notification ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notification}</p>
        ) : null}

        <section className="mb-8">
          <div className="mb-2 flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-[#111827]">문의 작성</h2>
            <span className="text-xs text-gray-400">{isAdmin ? '관리자도 새 문의를 등록할 수 있습니다' : '작성 후 등록하면 관리자에게 전달됩니다'}</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">제목</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, 100))}
                  maxLength={100}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#10b981]"
                  placeholder="문의 제목을 입력하세요 (최대 100자)"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">내용</label>
                <textarea
                  value={message}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMessage(v.slice(0, 1000));
                    setCharCount(v.slice(0, 1000).length);
                  }}
                  rows={6}
                  maxLength={1000}
                  onPaste={(e) => {
                    // prevent pasting very large data URLs into textarea
                    const clip = e.clipboardData.getData('text');
                    if (clip && clip.startsWith('data:')) e.preventDefault();
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#10b981]"
                  placeholder="문의할 내용을 자세히 작성해주세요 (최대 1000자)"
                />
                <div className="mt-2 text-right text-xs text-gray-400">{charCount}/1000</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label onPaste={handlePasteOnAttachments} className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-[#10b981] hover:bg-gray-50">
                  파일 첨부
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                </label>
                <button
                  type="submit"
                  disabled={loadingState}
                  className="rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  문의 등록
                </button>
              </div>

              {attachments.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">첨부 파일</p>
                  <ul className="space-y-2">
                    {attachments.map((file) => (
                      <li key={file.name} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                        <span>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(file.name)}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-900"
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </form>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-2 flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-[#111827]">{isAdmin ? '전체 문의 목록' : '내 문의 내역'}</h2>
            <span className="text-xs text-gray-400">
              {loadingState ? '로딩 중...' : isAdmin ? '문의를 확인하고 답변할 수 있습니다' : '접수한 문의와 관리자 답변을 확인하세요'}
            </span>
          </div>

          {inquiries.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
              {isAdmin ? '등록된 문의가 없습니다.' : '아직 문의가 없습니다. 새 문의를 남겨보세요.'}
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-500">
                  총 {inquiries.length}개 · {safeCurrentPage}/{totalPages} 페이지
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <span>페이지당</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#10b981]"
                  >
                    <option value={5}>5개</option>
                    <option value={10}>10개</option>
                    <option value={20}>20개</option>
                  </select>
                </label>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
                {pagedInquiries.map((item) => (
                  <article key={item.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-400">{formatDate(item.createdAt)}</div>
                        <h3 className="mt-1 wrap-break-word text-base font-semibold text-gray-900">{item.subject}</h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{item.authorRole === 'admin' ? '관리자' : '사용자'}</span>
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'answered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.status === 'answered' ? '답변 완료' : '처리 중'}</span>
                      </div>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{item.message}</div>

                    {item.attachments && item.attachments.length > 0 ? (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <h4 className="text-sm font-semibold text-gray-800">첨부 파일</h4>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {item.attachments.map((file) => (
                            <div key={file.name} className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700">
                              <div className="font-semibold">{file.name}</div>
                              <div className="mt-1 text-xs text-gray-400">{file.mime}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {item.reply ? (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-gray-800">
                        <div className="font-semibold text-emerald-700">관리자 답변</div>
                        <p className="mt-2 whitespace-pre-wrap">{item.reply}</p>
                        <div className="mt-3 text-xs text-gray-400">{item.repliedBy} · {item.repliedAt ? formatDate(item.repliedAt) : ''}</div>
                      </div>
                    ) : null}

                    {isAdmin ? (
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => handleDeleteInquiry(item.id)}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-400"
                        >
                          삭제
                        </button>
                        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                          <input
                            type="text"
                            value={activeReplyId === item.id ? replyText : ''}
                            onChange={(e) => {
                              setActiveReplyId(item.id);
                              setReplyText(e.target.value);
                            }}
                            placeholder="관리자 답변을 입력하세요"
                            className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 outline-none transition focus:border-[#10b981]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReplyId(item.id);
                              handleReply(item.id);
                            }}
                            className="rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                          >
                            답변 저장
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage === 1}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  이전
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${page === safeCurrentPage ? 'bg-[#111827] text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
