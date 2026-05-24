
export default function AnalysisEnginePage({
  isMenuOpen,
  setIsMenuOpen,
  counselTarget,
  setCounselTarget,
  counselText,
  setCounselText,  analysisStep,  setAnalysisStep,
  handleReset, handleAnalyze
}: {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  counselTarget: string;
  setCounselTarget: (target: string) => void;
  counselText: string;
  setCounselText: (text: string) => void;
  analysisStep: 'input' | 'analyzing' | 'results';
  setAnalysisStep: (step: 'input' | 'analyzing' | 'results') => void;
  handleReset: () => void;
  handleAnalyze: (resultType: 'genogram' | 'ecomap' | 'report') => void;
}) {
  const exampleCounselText = `엄마 조미란 78년생은 7남매(4남 3녀) 중 다섯째임. 형제가 많아 외가 쪽 가계도가 매우 넓음. 아빠 서태지 75년생은 2남 중 장남임. 자녀는 아들 서진우 08년생 하나임. 외할아버지는 돌아가셨으나 외할머니와 6명의 이모/삼촌들은 모두 연락하며 지냄.`;
  const exampleCounselTarget = "조미란";
  const setExampleSounsel = () => {
    setCounselText(exampleCounselText);
    setCounselTarget(exampleCounselTarget);
  }
  return (
    <div 
      className={`absolute top-0 right-0 h-full bg-white border-l border-gray-100 shadow-[20px_0_60px_rgba(0,0,0,0.15)] lg:shadow-none transition-all duration-300 ease-in-out z-40 flex
        ${isMenuOpen ? 'w-full lg:w-[600px] translate-x-0' : 'w-0 translate-x-full lg:translate-x-0 lg:w-0'}
      `}
    >
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full h-24 w-10 rounded-l-2xl border-y border-l border-gray-100 bg-white shadow-[-6px_0_15px_rgba(0,0,0,0.03)] flex flex-col items-center justify-center text-gray-400 hover:text-gray-700 transition-all z-50
          hover:cursor-pointer
          ${!isMenuOpen ? 'animate-pulse ring-4 ring-[#10b981]/10' : ''}
        `}
        title={isMenuOpen ? "메뉴 숨기기" : "분석 엔진 열기"}
      >
        {isMenuOpen ? (
          <svg className="w-4 h-4 text-[#10b981] transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-[#10b981] transition-transform duration-300 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
          </svg>
        )}
        <span className="text-[9px] font-bold text-gray-500 [writing-mode:vertical-lr] mt-1.5 tracking-widest">
          {isMenuOpen ? "CLOSE" : "OPEN"}
        </span>
      </button>
      <div className="w-full h-full flex flex-col p-6 lg:p-10 overflow-y-auto">
        {/* AI 분석 엔진 헤더 */}
        <div className="mb-6 relative flex justify-between items-start">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 mb-2">
              AI Relationship Network Analysis Engine 2.0
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 leading-tight">
              내용을 입력하세요
            </h1>
            <p className="text-lg lg:text-xl font-extrabold text-[#10b981] mt-0.5">
              AI 분석 엔진
            </p>
          </div>
          
          {/* 모바일 화면 닫기 전용 X 단추 */}
          <button 
            onClick={() => setIsMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {(analysisStep === 'input'|| analysisStep === 'results') && (
          <div className="flex-1 flex flex-col justify-between space-y-6">
            <div className="relative flex-1 flex flex-col min-h-[320px] gap-3">
            <input 
              type="text" 
              value={counselTarget}
              
              onChange={(e) => setCounselTarget(e.target.value)}
              placeholder={`띄어쓰기 없이 대상자/내담자의 이름을 입력해주세요. 예시: 홍길동`}
              className="w-full flex flex-row p-5 rounded-2xl border border-gray-100 bg-[#f9fafc] text-gray-700 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#10b981]/20 focus:border-[#10b981] transition-all resize-none shadow-inner leading-relaxed" 
            />
              {/* 텍스트 영역 */}
              <textarea
                className="w-full flex-1 p-5 rounded-2xl border border-gray-100 bg-[#f9fafc] text-gray-700 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#10b981]/20 focus:border-[#10b981] transition-all resize-none shadow-inner leading-relaxed"
                placeholder="사회복지사님의 상담 기록을 입력하거나 붙여넣으세요. &#10;&#10;예시: '대상자는 현재 72세 여성으로, 근처에 살고 있는 딸 영희가 매주 방문해서 돌보고 있습니다. 하지만 장남인 철수와는 수년간 연락이 닿지 않아 단절 상태입니다...'"
                value={counselText}
                onChange={(e) => setCounselText(e.target.value)}
              />
              
              {/* 퀵 프리셋 버튼 */}
              {counselText.length === 0 && (
                <button 
                  onClick={() => setExampleSounsel()}
                  className="absolute bottom-5 left-5 right-5 text-left inline-flex items-center text-xs text-[#10b981] hover:underline font-semibold bg-white px-3 py-2.5 rounded-xl shadow-sm border border-gray-100"
                >
                  <span>✨ 가상 완성형 사례 연구 데이터 입력</span>
                </button>
              )}
            </div>

            {/* 제어 패널 */}
            <div className="space-y-3">
              <div className="text-[11px] text-gray-400 font-bold px-1">실행할 분석 기능을 선택하세요</div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleAnalyze('genogram')}
                  className="flex items-center justify-center space-x-1.5 py-3.5 px-4 rounded-xl bg-[#10b981] text-white text-xs font-bold hover:bg-[#0da673] transition-all active:scale-[0.98] shadow-md shadow-[#10b981]/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>가계도 분석</span>
                </button>

                <button
                  onClick={() => handleAnalyze('ecomap')}
                  className="flex items-center justify-center space-x-1.5 py-3.5 px-4 rounded-xl bg-[#10b981] text-white text-xs font-bold hover:bg-[#0da673] transition-all active:scale-[0.98] shadow-md shadow-[#10b981]/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  <span>생태도 분석</span>
                </button>

                <button
                  onClick={() => handleAnalyze('report')}
                  className="flex items-center justify-center space-x-1.5 py-3.5 px-4 rounded-xl bg-white text-gray-700 border border-gray-200 text-xs font-bold hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>사례보고서</span>
                </button>
              </div>
            </div>

          </div>
        )}
        {analysisStep === 'analyzing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-[#10b981]"></div>
              <div className="absolute inset-0 flex items-center justify-center text-xs text-[#10b981] font-bold">AI</div>
            </div>
            <p className="text-gray-900 font-bold text-md text-center">원문 텍스트 구조 분석 중...</p>
            <p className="text-gray-400 text-xs mt-1.5 text-center leading-relaxed">
              사회복지 데이터 문맥에서 가족 관계 구조 및 <br />
              외부 공식·비공식 자원망 연결 상태를 식별하고 있습니다.
            </p>
          </div>
        )}
        {analysisStep === 'results' && (
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>현재 메인 화면에 분석 결과가 표시 중입니다.</span>
            <button onClick={handleReset} className="text-[#10b981] font-bold hover:underline">리셋하기</button>
          </div>
        )}
      </div>
    </div>
  )
}