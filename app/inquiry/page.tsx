'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
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
  const { isAuthenticated, loading, isAdmin } = useAuth();
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <p>인증 상태를 확인 중입니다...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm shadow-slate-200/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{standardLabel}</h1>
              <p className="mt-1 text-sm md:text-base text-slate-600">문의는 관리자에게만 공개되며, 다른 사용자에게는 비공개로 처리됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm md:text-base font-semibold text-white transition hover:bg-slate-700"
            >
              돌아가기
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm shadow-slate-200/60">
          <div className="mb-4 text-sm md:text-base text-slate-600">
            {isAdmin ? '관리자도 이 폼으로 새 문의를 등록할 수 있습니다.' : '문의 제목과 내용을 작성한 뒤 등록하면 관리자에게 전달됩니다.'}
          </div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm md:text-base font-medium text-slate-700">제목</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm md:text-base text-slate-900 outline-none transition focus:border-slate-500"
                placeholder="문의 제목을 입력하세요"
              />
            </div>
              <div>
                <label className="mb-2 block text-sm md:text-base font-medium text-slate-700">내용</label>
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
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm md:text-base lg:text-lg text-slate-900 outline-none transition focus:border-slate-500"
                  placeholder="문의할 내용을 자세히 작성해주세요 (최대 1000자)"
                />
                <div className="mt-2 text-right text-xs md:text-sm text-slate-500">{charCount}/1000</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label onPaste={handlePasteOnAttachments} className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm md:text-base text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
                  파일 첨부
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                </label>
                <button
                  type="submit"
                  disabled={loadingState}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm md:text-base font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  문의 등록
                </button>
              </div>

            {attachments.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:text-base text-slate-700">
                <p className="font-semibold text-slate-900">첨부 파일</p>
                <ul className="space-y-2">
                  {attachments.map((file) => (
                    <li key={file.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <span>{file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(file.name)}
                        className="text-xs md:text-sm font-semibold text-slate-600 hover:text-slate-900"
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

        <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-slate-900">{isAdmin ? '전체 문의 목록' : '내 문의 내역'}</h2>
              <p className="mt-1 text-sm md:text-base text-slate-600">{isAdmin ? '모든 사용자가 보낸 문의를 확인하고 답변할 수 있습니다.' : '회원님이 접수한 문의와 관리자 답변을 확인하세요.'}</p>
            </div>
            {loadingState ? <span className="text-sm text-slate-500">로딩 중...</span> : null}
          </div>

            {fetchError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm md:text-base text-red-700">{fetchError}</div>
          ) : null}
          {notification ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm md:text-base text-emerald-700">{notification}</div>
          ) : null}

          <div className="mt-6 space-y-4">
            {inquiries.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                {isAdmin ? '등록된 문의가 없습니다.' : '아직 문의가 없습니다. 새 문의를 남겨보세요.'}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm md:text-base text-slate-500">
                    총 {inquiries.length}개 · {safeCurrentPage}/{totalPages} 페이지
                  </div>
                  <label className="flex items-center gap-2 text-sm md:text-base text-slate-600">
                    <span>페이지당</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:text-base text-slate-900 outline-none"
                    >
                      <option value={5}>5개</option>
                      <option value={10}>10개</option>
                      <option value={20}>20개</option>
                    </select>
                  </label>
                </div>

                {pagedInquiries.map((item) => (
                <article key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <div className="relative">
                    <div className="absolute right-4 top-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs md:text-sm font-semibold text-slate-700">{item.authorRole === 'admin' ? '관리자' : '사용자'}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs md:text-sm font-semibold text-slate-700">{item.status === 'answered' ? '답변 완료' : '처리 중'}</span>
                    </div>
                    <div>
                      <div className="text-sm md:text-base text-slate-500">{formatDate(item.createdAt)}</div>
                      <h3 className="mt-2 text-lg md:text-xl font-semibold text-slate-900">{item.subject}</h3>
                      <div className="mt-2 text-sm md:text-base lg:text-lg text-slate-600 whitespace-pre-wrap">{item.message}</div>
                    </div>
                  </div>

                  {item.attachments && item.attachments.length > 0 ? (
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm md:text-base font-semibold text-slate-800">첨부 파일</h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {item.attachments.map((file) => (
                          <div key={file.name} className="rounded-2xl border border-slate-200 p-3 text-sm md:text-base text-slate-700">
                            <div className="font-semibold">{file.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{file.mime}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                    {item.reply ? (
                    <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm md:text-base text-slate-800">
                      <div className="font-semibold text-emerald-700">관리자 답변</div>
                      <p className="mt-2 whitespace-pre-wrap">{item.reply}</p>
                      <div className="mt-3 text-xs text-slate-500">{item.repliedBy} · {item.repliedAt ? formatDate(item.repliedAt) : ''}</div>
                    </div>
                  ) : null}

                  {isAdmin ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              onClick={() => handleDeleteInquiry(item.id)}
                              className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-sm md:text-base font-semibold text-red-700 transition hover:bg-red-100"
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
                                className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm md:text-base text-slate-900 outline-none transition focus:border-slate-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveReplyId(item.id);
                                  handleReply(item.id);
                                }}
                                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm md:text-base font-semibold text-white transition hover:bg-slate-700"
                              >
                                답변 저장
                              </button>
                            </div>
                          </div>
                  ) : null}
                </article>
                ))}

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                    className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    이전
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition ${page === safeCurrentPage ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
