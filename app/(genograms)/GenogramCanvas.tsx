'use client';

import { calculateGenogramLayout } from '@/lib/genograms/bowen/calculator-nodes';
import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';
import { BWGenogramData, PersonNode, ChildGroup } from '@/types/bowengenogram.types';
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Printer, Maximize, Frame, Scaling, Plus, Minus, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props { data: BWGenogramData; }

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.2;

// 출력 배율(도형 크기): 화면 줌과 달리 실제 출력 크기 → 인쇄 페이지 수/가이드에 반영
const CS_MIN = 0.4;
const CS_MAX = 2.5;
const CS_STEP = 1.15;

// A4 가로 한 페이지에 인쇄되는 영역(96DPI, 10mm 여백 기준): 277mm×190mm ≈ 1047×718px
const A4_PAGE_W = 1047;
const A4_PAGE_H = 718;

export default function GenogramCanvas({ data: initialData }: Props) {
  // 1. 순서 재정렬 후 물리적인 양수 좌표 및 캔버스 크기 최종 산출
  const processedData = useMemo(() => {
    const ordered = reorderDisplayOrders(initialData);
    return calculateGenogramLayout(ordered);
  }, [initialData]);

  // 확대/축소 상태 (1 = 100%) — 화면 보기 전용, 인쇄에는 미반영
  const [zoom, setZoom] = useState(1);
  // 출력 배율(도형 크기, 1 = 100%) — 실제 출력 크기, 인쇄 페이지 수/가이드에 반영
  const [contentScale, setContentScale] = useState(1);
  // A4 페이지 가이드라인 표시 여부 (인쇄에는 나오지 않음)
  const [showGuide, setShowGuide] = useState(true);
  // 사용 설명서 팝업
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPage, setHelpPage] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const zoomIn = () => setZoom((z) => clampZoom(z * ZOOM_STEP));
  const zoomOut = () => setZoom((z) => clampZoom(z / ZOOM_STEP));
  const zoomReset = () => setZoom(1);

  const clampCS = (s: number) => Math.min(CS_MAX, Math.max(CS_MIN, s));
  const scaleUp = () => setContentScale((s) => clampCS(s * CS_STEP));
  const scaleDown = () => setContentScale((s) => clampCS(s / CS_STEP));
  const scaleReset = () => setContentScale(1);

  // 화면(뷰포트)에 캔버스 전체가 들어오도록 배율 자동 조정 (출력 배율 반영)
  const fitToScreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pad = 32; // 컨테이너 p-4(16px) 양쪽
    const availW = el.clientWidth - pad;
    const availH = el.clientHeight - pad;
    const w = processedData.canvasSize.width * contentScale;
    const h = processedData.canvasSize.height * contentScale;
    if (w <= 0 || h <= 0) return;
    setZoom(clampZoom(Math.min(availW / w, availH / h)));
  }, [processedData.canvasSize, contentScale]);

  // 그랩(드래그) 팬: 스크롤바 없이 마우스로 캔버스를 끌어 이동
  const panRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const onPanStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // 좌클릭만
    const el = containerRef.current;
    if (!el) return;
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setIsPanning(true);
    el.setPointerCapture?.(e.pointerId);
  };
  const onPanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollLeft = panRef.current.scrollLeft - (e.clientX - panRef.current.startX);
    el.scrollTop = panRef.current.scrollTop - (e.clientY - panRef.current.startY);
  };
  const onPanEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) return;
    panRef.current.active = false;
    setIsPanning(false);
    containerRef.current?.releasePointerCapture?.(e.pointerId);
  };

  // 마우스 휠 = 확대/축소 (캔버스 위에서만). 커서 지점을 중심으로 줌.
  // React onWheel 은 passive 라 preventDefault 가 안 되므로 네이티브 non-passive 리스너 사용.
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const old = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, old * factor));
      if (next === old) return;
      const ratio = next / old;
      // 커서 아래의 콘텐츠 지점을 줌 후에도 같은 위치에 유지
      const contentX = el.scrollLeft + px;
      const contentY = el.scrollTop + py;
      zoomRef.current = next;
      setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = contentX * ratio - px;
        el.scrollTop = contentY * ratio - py;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 인쇄 / PDF 저장: 가로(landscape) 페이지로 새 창을 열어 브라우저 인쇄 대화상자 호출
  // (인쇄 대화상자의 대상에서 "PDF로 저장"을 선택하면 그대로 PDF 다운로드가 된다)
  const handlePrint = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { width, height } = processedData.canvasSize;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    // 가이드라인 등 화면 전용 요소는 인쇄본에서 제거
    clone.querySelectorAll('.print-hide').forEach((el) => el.remove());
    // 내부 마크업만 추출 → 인쇄 창에서 페이지별 SVG(viewBox 로 영역 잘라내기)에 재사용
    const innerMarkup = Array.from(clone.childNodes)
      .map((n) => new XMLSerializer().serializeToString(n))
      .join('');

    // 주의: noopener/noreferrer 를 주면 반환값이 null 이 되어 새 창에 내용을 쓸 수 없다.
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) {
      alert('팝업이 차단되었습니다. 인쇄를 위해 팝업을 허용해주세요.');
      return;
    }
    win.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>상담 데이터 기반 가계도</title>
<style>
  /* 용지 방향은 아래 #page-style 에서 동적으로 지정 (기본: 가로) */
  html, body { margin: 0; padding: 0; font-family: sans-serif; }
  .toolbar {
    position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; align-items: center;
    padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  }
  .toolbar .label { font-size: 13px; font-weight: 600; color: #475569; margin-right: 4px; }
  .toolbar button {
    font: inherit; font-size: 13px; padding: 6px 14px; border-radius: 8px; cursor: pointer;
    border: 1px solid #cbd5e1; background: #fff; color: #334155;
  }
  .toolbar button.seg.active { background: #2563eb; border-color: #2563eb; color: #fff; }
  .toolbar .sep { width: 1px; height: 22px; background: #cbd5e1; margin: 0 6px; }
  .toolbar .spacer { flex: 1; }
  .toolbar .hint { font-size: 12px; color: #94a3b8; margin-right: 10px; }
  .toolbar button.print { background: #111827; border-color: #111827; color: #fff; }
  /* 페이지 미리보기: 각 .page 가 A4 한 장의 인쇄영역 크기 */
  #pages { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 16px; padding: 16px; background: #e2e8f0; }
  .page { background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); overflow: hidden; }
  .page svg { display: block; }
  /* 이름표(foreignObject) 최소 스타일 재현 (인쇄창에는 Tailwind가 없음) */
  foreignObject div { display: flex; justify-content: center; }
  foreignObject span {
    display: inline-block; border: 1px solid #e2e8f0; background: #f8fafc;
    padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;
    color: #000; line-height: 1.2; text-align: center;
  }
  @media print {
    .toolbar { display: none !important; }
    /* 각 .page 를 물리적 A4 한 장으로 강제 분할 (브라우저 자동 축소 방지) */
    #pages { display: block; gap: 0; padding: 0; background: #fff; }
    .page { box-shadow: none; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
  }
</style>
<style id="page-style">@page { size: A4 landscape; margin: 10mm; }</style>
</head>
<body>
  <div class="toolbar">
    <span class="label">용지 방향</span>
    <button type="button" class="seg active" id="btn-landscape" onclick="setOrientation('landscape')">가로</button>
    <button type="button" class="seg" id="btn-portrait" onclick="setOrientation('portrait')">세로</button>
    <span class="sep"></span>
    <span class="label">크기</span>
    <button type="button" class="seg active" id="btn-actual" onclick="setFit('actual')">실제 크기(여러 장)</button>
    <button type="button" class="seg" id="btn-page" onclick="setFit('page')">한 장에 맞춤</button>
    <span class="spacer"></span>
    <span class="hint">머리글/바닥글 끄면 가이드와 정확히 일치</span>
    <button type="button" class="print" onclick="window.print()">인쇄 / PDF 저장</button>
  </div>
  <div id="pages"></div>
  <script>
    var W = ${width}, H = ${height};
    var CS = ${contentScale}; // 출력 배율(도형 크기)
    var INNER = ${JSON.stringify(innerMarkup)};
    // A4 인쇄영역(96DPI, 10mm 여백): 가로 1047x718 / 세로 718x1047 (캔버스 가이드와 동일 기준)
    var PAGE = { landscape: { w: 1047, h: 718 }, portrait: { w: 718, h: 1047 } };
    var orientation = 'landscape';
    var fit = 'actual';

    function pageDiv(vx, vy, vbW, vbH, pxW, pxH) {
      return '<div class="page" style="width:' + pxW + 'px;height:' + pxH + 'px;">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + pxW + '" height="' + pxH +
        '" viewBox="' + vx + ' ' + vy + ' ' + vbW + ' ' + vbH + '">' + INNER + '</svg></div>';
    }
    function render() {
      var p = PAGE[orientation];
      var out = '';
      if (fit === 'page') {
        // 전체를 한 페이지 인쇄영역에 맞게 축소(작으면 확대) — 출력 배율과 무관
        var s = Math.min(p.w / W, p.h / H);
        out = pageDiv(0, 0, W, H, W * s, H * s);
      } else {
        // 실제 크기: 한 페이지가 담는 레이아웃 범위 = 인쇄영역 / 출력배율
        var tileW = p.w / CS, tileH = p.h / CS;
        var cols = Math.max(1, Math.ceil(W / tileW));
        var rows = Math.max(1, Math.ceil(H / tileH));
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var vw = Math.min(tileW, W - c * tileW);
            var vh = Math.min(tileH, H - r * tileH);
            // viewBox 는 레이아웃 좌표, 픽셀 크기는 출력배율만큼 확대 → 100% * CS 로 인쇄
            out += pageDiv(c * tileW, r * tileH, vw, vh, vw * CS, vh * CS);
          }
        }
      }
      document.getElementById('pages').innerHTML = out;
    }
    function setOrientation(o) {
      orientation = o;
      document.getElementById('page-style').textContent =
        '@page { size: A4 ' + o + '; margin: 10mm; }';
      document.getElementById('btn-landscape').classList.toggle('active', o === 'landscape');
      document.getElementById('btn-portrait').classList.toggle('active', o === 'portrait');
      render();
    }
    function setFit(f) {
      fit = f;
      document.getElementById('btn-actual').classList.toggle('active', f === 'actual');
      document.getElementById('btn-page').classList.toggle('active', f === 'page');
      render();
    }
    window.onload = function () { render(); window.focus(); };
  </script>
</body>
</html>`);
    win.document.close();
  }, [processedData.canvasSize, contentScale]);

  // 빠른 노드 좌표 탐색을 위한 맵 캐싱
  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    processedData.nodes.forEach((node) => {
      pos[node.id] = {
        x: node.layoutPosition.x,
        y: node.layoutPosition.y,
      };
    });
    return pos;
  }, [processedData]);

  // 관계선 (부부선, 이혼선, 자녀 ㄷ자선) 렌더링 함수
  const renderRelationships = () => {
    const elements: React.JSX.Element[] = [];
    const marriageLineDepth = 45; 

    processedData.familyUnits.forEach((unit, idx) => {
      const parents = unit.parent_ids.map(id => ({
        id, 
        pos: nodePositions[id], 
        node: processedData.nodes.find(n => n.id === id)
      }));

      // 부모 좌표 최소 1명 확보 검증
      if (parents.length === 0 || !parents[0].pos) return;

      let coupleMidX: number;
      let coupleBottomY: number;

      // --- 1단계: 부부 결합선 렌더링 ---
      if (parents.length === 2 && parents[1].pos && unit.lineCenterPosition) {
        const p1 = parents[0].pos;
        const p2 = parents[1].pos;
        
        // 정렬 엔진이 계산해 둔 "ㄷ"자 결합선 허브 좌표 활용
        coupleMidX = unit.lineCenterPosition.x;

        // 부부 사이에 낀 노드가 '자식을 가진 부모'일 때만 결합선을 깊게 우회한다.
        // (자식 없는 leaf 형제는 우회 불필요 → 얕은 결합선 유지, 자녀선이 어긋나지 않음)
        const hasInterruption = processedData.nodes.some(n =>
          n.relLevel === parents[0].node?.relLevel &&
          n.layoutPosition.x > Math.min(p1.x, p2.x) && n.layoutPosition.x < Math.max(p1.x, p2.x) &&
          !unit.parent_ids.includes(n.id) &&
          processedData.familyUnits.some(u =>
            u.parent_ids.includes(n.id) && (u.childGroups?.some(g => g.child_ids.length > 0))
          )
        );
        const currentDepth = hasInterruption ? marriageLineDepth + 150 : marriageLineDepth;
        coupleBottomY = unit.lineCenterPosition.y + currentDepth;
        // 부부 "ㄷ"자 수평선 긋기 (동거/혼외관계 common_law는 점선)
        elements.push(
          <path
            key={`marriage-${unit.id}-${idx}`}
            d={`M ${p1.x} ${p1.y + 25} V ${coupleBottomY} H ${p2.x} V ${p2.y + 25}`}
            fill="none"
            stroke="#333"
            strokeWidth="2"
            strokeDasharray={unit.legal_status === 'common_law' ? '6 4' : undefined}
          />
        );

        // 상태 기호 (별거: 사선1, 이혼: 사선2, 이혼후재결합: ✕)
        if (unit.legal_status === 'divorced') {
          elements.push(
            <g key={`divorce-mark-${unit.id}`} stroke="#333" strokeWidth="2">
              <line x1={coupleMidX - 8} y1={coupleBottomY - 10} x2={coupleMidX + 2} y2={coupleBottomY + 10} />
              <line x1={coupleMidX - 2} y1={coupleBottomY - 10} x2={coupleMidX + 8} y2={coupleBottomY + 10} />
            </g>
          );
        } else if (unit.legal_status === 'separated') {
          elements.push(
            <line key={`sep-mark-${unit.id}`} x1={coupleMidX - 5} y1={coupleBottomY - 10} x2={coupleMidX + 5} y2={coupleBottomY + 10} stroke="#333" strokeWidth="2" />
          );
        } else if (unit.legal_status === 'reconciled') {
          // 이혼 후 재결합: 이혼선(사선 2개) 위에 반대 방향 사선 2개를 덧그어 '취소' 형태
          elements.push(
            <g key={`reconcile-mark-${unit.id}`} stroke="#333" strokeWidth="2">
              {/* 이혼선 (//) */}
              <line x1={coupleMidX - 8} y1={coupleBottomY - 10} x2={coupleMidX + 2} y2={coupleBottomY + 10} />
              <line x1={coupleMidX - 2} y1={coupleBottomY - 10} x2={coupleMidX + 8} y2={coupleBottomY + 10} />
              {/* 취소 (반대 방향 사선) */}
              <line x1={coupleMidX + 8} y1={coupleBottomY - 10} x2={coupleMidX - 8} y2={coupleBottomY + 10} />
            </g>
          );
        }

        // 관계 이벤트 년도 표기 (자료 기준: m. / LT / s. / d. / remar.)
        const yy = (y: number) => (String(y).length > 2 ? String(y).slice(-2) : String(y));
        let statusText = '';
        if (unit.legal_status === 'common_law') {
          const lt = unit.cohabitation_year ?? unit.marriage_year;
          if (lt) statusText = `LT ${yy(lt)}`;
        } else {
          const parts: string[] = [];
          if (unit.marriage_year) parts.push(`m. ${yy(unit.marriage_year)}`);
          if (unit.separation_year) parts.push(`s. ${yy(unit.separation_year)}`);
          if (unit.divorce_year) parts.push(`d. ${yy(unit.divorce_year)}`);
          if (unit.reunion_year) parts.push(`remar. ${yy(unit.reunion_year)}`);
          statusText = parts.join(' ');
        }
        if (statusText) {
          elements.push(
            <text key={`m-text-${unit.id}`} x={coupleMidX} y={coupleBottomY - 8} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#475569">
              {statusText}
            </text>
          );
        }
      } else {
        // 편부모 가정의 경우 부모 위치 바로 아래에서 수직 가이드라인 생성
        coupleMidX = parents[0].pos.x;
        coupleBottomY = parents[0].pos.y + 25;
      }

      // --- 2단계: 자녀 연결선 렌더링 (childGroups 기반 평탄화) ---
      // 모든 childGroups에 포함된 자녀 ID 및 좌표 묶기
      const childNodesWithPos = (unit.childGroups || []).reduce((acc: any[], group: ChildGroup) => {
        const groupItems = group.child_ids.map(id => ({
          id,
          pos: nodePositions[id],
          groupType: group.type // 쌍둥이 판별용
        }));
        return [...acc, ...groupItems];
      }, []);

      if (childNodesWithPos.length > 0) {
        // 자녀선이 꺾여서 좌우로 퍼지는 분기점 높이 설정 (부부 하단선 + 40px)
        const childBranchY = coupleBottomY + 80;

        // 부부 중앙(허브)에서 자녀 수평 가이드선까지 내려오는 중심 줄기선
        elements.push(
          <line
            key={`stem-${unit.id}`}
            x1={coupleMidX} y1={coupleBottomY}
            x2={coupleMidX} y2={childBranchY}
            stroke="#333"
            strokeWidth="2"
          />
        );
        // 자녀 수평바의 min/max X
        let xCoords:number[] = [];
        

        // 각 자녀 노드 머리 위로 수직 하강하는 꺾임선 연결
        // (단, 쌍둥이 그룹인 경우 분기점이 달라지는 특수 규칙 적용)
        let processedTwinIds = new Set<string>();

        (unit.childGroups || []).forEach((group, gIdx) => {
          if (group.type === 'identical_twins' || group.type === 'fraternal_twins') {
            // 쌍둥이 처리: 가로 분기선에서 하나의 점에서 출발해 V자로 갈라짐
            const twinNodes = group.child_ids.map(id => ({ id, pos: nodePositions[id] })).filter(t => t.pos);
            if (twinNodes.length === 2) {
              const twinMidX = (twinNodes[0].pos.x + twinNodes[1].pos.x) / 2;
              
              xCoords.push(twinMidX); // 자녀 수평바의 X 좌표로 활용

              // 공통점에서 각 쌍둥이 노드 머리 위(-25px)까지 V자로 연결
              elements.push(
                <line key={`twin-v1-${unit.id}-${gIdx}`} x1={twinMidX} y1={childBranchY} x2={twinNodes[0].pos.x} y2={twinNodes[0].pos.y - 25} stroke="#333" strokeWidth="2" />,
                <line key={`twin-v2-${unit.id}-${gIdx}`} x1={twinMidX} y1={childBranchY} x2={twinNodes[1].pos.x} y2={twinNodes[1].pos.y - 25} stroke="#333" strokeWidth="2" />
              );

              // 일란성(identical) 쌍둥이인 경우 두 사선 사이를 연결하는 수평 가로선 추가 (보웬 규칙)
              if (group.type === 'identical_twins') {
                const innerY = childBranchY + 30; // V자 중간 높이 계산
                // 두 자녀 X 좌표의 내분점을 활용한 짧은 링킹 바
                elements.push(
                  <line key={`twin-identical-bar-${unit.id}-${gIdx}`} x1={twinNodes[0].pos.x} y1={twinNodes[0].pos.y - 25} x2={twinNodes[1].pos.x} y2={twinNodes[1].pos.y - 25} stroke="#333" strokeWidth="2" />
                );
              }
              group.child_ids.forEach(id => processedTwinIds.add(id));
            }
          }
        });

        // 쌍둥이가 아닌 일반 자녀들의 표준 수직선 매핑
        childNodesWithPos.forEach((child, cIdx) => {
          if (!child.pos || processedTwinIds.has(child.id)) return;
          xCoords.push(child.pos.x); // 자녀 수평바의 X 좌표로 활용
          const childNode = processedData.nodes.find(n => n.id === child.id);
          const rel = childNode?.attributes.child_relation;
          // 기호 상단까지 연결 (작은 손실/임신 기호는 짧게)
          const t = childNode?.type;
          const top = t === 'person' ? 25 : (t === 'fetus' || t === 'stillbirth') ? 12 : 8;
          const y2 = child.pos.y - top;
          if (rel === 'adopted') {
            // 입양: 실선 + 점선 (선 2개)
            elements.push(
              <line key={`child-v-${unit.id}-${cIdx}-s`} x1={child.pos.x - 3} y1={childBranchY} x2={child.pos.x - 3} y2={y2} stroke="#333" strokeWidth="2" />,
              <line key={`child-v-${unit.id}-${cIdx}-d`} x1={child.pos.x + 3} y1={childBranchY} x2={child.pos.x + 3} y2={y2} stroke="#333" strokeWidth="2" strokeDasharray="5 4" />
            );
          } else {
            // 친자녀: 실선 / 위탁(foster): 점선
            const dash = rel === 'foster' ? '5 4' : undefined;
            elements.push(
              <line key={`child-v-${unit.id}-${cIdx}`} x1={child.pos.x} y1={childBranchY} x2={child.pos.x} y2={y2} stroke="#333" strokeWidth="2" strokeDasharray={dash} />
            );
          }
        });

        // 자녀가 2명 이상일 때 가로로 길게 뻗는 수평 바(Bar) 렌더링
        if (childNodesWithPos.length >= 2) {
          // const xCoords = childNodesWithPos.map(c => c.pos?.x).filter(x => x !== undefined) as number[];
          
          if (xCoords.length > 0) {
            const minChildX = Math.min(...xCoords);
            const maxChildX = Math.max(...xCoords);

            // 가로 분기선이 가장 왼쪽 자녀부터 가장 오른쪽 자녀(조미란 포함)까지 완벽하게 이어짐
            elements.push(
              <line
                key={`branch-h-${unit.id}`}
                x1={minChildX} y1={childBranchY}
                x2={maxChildX} y2={childBranchY}
                stroke="#333"
                strokeWidth="2"
              />
            );
          }
        }
      }
    });

    return elements;
  };

  const zoomPct = Math.round(zoom * 100);

  // A4 페이지 경계 가이드라인 (인쇄 시 clone에서 .print-hide 로 제거됨)
  // 한 페이지가 담는 레이아웃 범위 = 인쇄영역 / 출력배율 → 인쇄 분할과 동일 기준
  const renderPageGuides = () => {
    if (!showGuide) return null;
    const { width, height } = processedData.canvasSize;
    const tileW = A4_PAGE_W / contentScale;
    const tileH = A4_PAGE_H / contentScale;
    // 배율이 커져도 화면상 선 두께/글자 크기가 일정하도록 보정
    const sw = 1.5 / contentScale;
    const fs = 12 / contentScale;
    const rects: React.JSX.Element[] = [];
    let pageNo = 1;
    for (let y = 0; y < height; y += tileH) {
      for (let x = 0; x < width; x += tileW) {
        rects.push(
          <rect
            key={`guide-${x}-${y}`}
            x={x + sw}
            y={y + sw}
            width={Math.min(tileW, width - x) - sw * 2}
            height={Math.min(tileH, height - y) - sw * 2}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={sw}
            strokeDasharray={`${10 / contentScale} ${8 / contentScale}`}
            opacity={0.55}
          />
        );
        rects.push(
          <text
            key={`guide-label-${x}-${y}`}
            x={x + 8 / contentScale}
            y={y + 20 / contentScale}
            fontSize={fs}
            fontWeight={700}
            fill="#3b82f6"
            opacity={0.6}
          >
            {`A4 · ${pageNo++}`}
          </text>
        );
      }
    }
    return <g className="print-hide">{rects}</g>;
  };

  // 사용 설명서 페이지 내용
  const helpPages: { icon: React.JSX.Element; title: string; lines: string[] }[] = [
    {
      icon: <ZoomIn size={18} />,
      title: '확대 / 축소 (화면 보기)',
      lines: [
        '돋보기 −/+ 버튼 또는 마우스 휠로 화면을 확대·축소합니다.',
        '마우스 휠은 커서 위치를 중심으로 확대/축소됩니다.',
        '가운데 % 를 클릭하면 100%로 되돌아갑니다.',
        '화면 보기 전용이라 인쇄 크기에는 영향을 주지 않습니다.',
        '확대된 상태에서는 캔버스를 마우스로 끌어(그랩) 이동할 수 있습니다.',
      ],
    },
    {
      icon: <Scaling size={18} />,
      title: '출력 배율 (도형 크기)',
      lines: [
        '⤢ −/+ 로 가계도 자체의 크기를 키우거나 줄입니다.',
        '돋보기(화면 줌)와 달리 실제 출력 크기가 바뀝니다.',
        '배율을 키우면 도형이 커져 A4 한 장에 담기는 범위가 줄고, 인쇄 페이지 수와 A4 가이드에 그대로 반영됩니다.',
        '가운데 % 를 클릭하면 100%로 초기화됩니다.',
      ],
    },
    {
      icon: <Frame size={18} />,
      title: '화면 맞춤 · A4 가이드',
      lines: [
        '화면 맞춤(⤢): 캔버스 전체가 화면에 들어오도록 배율을 자동 조정합니다.',
        'A4 가이드(▦): A4 한 장에 인쇄되는 범위를 파란 점선으로 표시하거나 숨깁니다.',
        '가이드 박스 하나(A4·1, A4·2 …)가 실제 A4 한 장에 해당합니다.',
        '가이드는 화면 표시용이라 인쇄물에는 나오지 않습니다.',
      ],
    },
    {
      icon: <Printer size={18} />,
      title: '인쇄 / PDF 저장',
      lines: [
        '인쇄 창을 엽니다. 대상에서 "PDF로 저장"을 고르면 PDF로 저장됩니다.',
        '용지 방향(가로/세로)과 크기(실제 크기 여러 장 / 한 장에 맞춤)를 선택할 수 있습니다.',
        '"실제 크기"는 A4 가이드와 1:1로 나뉘어 인쇄됩니다.',
        '정확한 크기를 위해 인쇄 대화상자에서 머리글/바닥글을 꺼주세요.',
      ],
    },
  ];
  const help = helpPages[helpPage];

  return (
    <div className="relative z-10 w-full h-full">
      {/* 확대/축소·인쇄 컨트롤 (스크롤과 무관하게 좌하단 고정) */}
      <div className={`absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 p-1 shadow-md backdrop-blur ${helpOpen ? 'z-40 pointer-events-none' : 'z-20'}`}>
        {/* 사용 설명서 열기 (가장 좌측) */}
        <button
          type="button"
          onClick={() => { setHelpPage(0); setHelpOpen(true); }}
          title="사용 설명서"
          aria-label="사용 설명서 열기"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
        >
          <HelpCircle size={18} />
        </button>
        <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          title="축소"
          aria-label="축소"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <ZoomOut size={18} />
        </button>
        <button
          type="button"
          onClick={zoomReset}
          title="100%로 초기화"
          aria-label="확대율 초기화"
          className="min-w-[46px] rounded-lg px-1 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          {zoomPct}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          title="확대"
          aria-label="확대"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <ZoomIn size={18} />
        </button>
        <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />
        {/* 출력 배율(도형 크기): 인쇄 페이지 수/가이드에 반영 (돋보기와 구분) */}
        <span className="pl-0.5 text-slate-400" title="출력 배율(도형 크기)">
          <Scaling size={16} />
        </span>
        <button
          type="button"
          onClick={scaleDown}
          disabled={contentScale <= CS_MIN}
          title="출력 크기 축소"
          aria-label="출력 크기 축소"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          onClick={scaleReset}
          title="출력 배율 100%로 초기화"
          aria-label="출력 배율 초기화"
          className="min-w-[46px] rounded-lg px-1 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          {Math.round(contentScale * 100)}%
        </button>
        <button
          type="button"
          onClick={scaleUp}
          disabled={contentScale >= CS_MAX}
          title="출력 크기 확대"
          aria-label="출력 크기 확대"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
        <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />
        <button
          type="button"
          onClick={fitToScreen}
          title="화면에 맞춤"
          aria-label="화면에 맞춤"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
        >
          <Maximize size={18} />
        </button>
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          title={showGuide ? 'A4 가이드 숨기기' : 'A4 가이드 보기'}
          aria-label="A4 가이드라인 표시 전환"
          aria-pressed={showGuide}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100 ${showGuide ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
        >
          <Frame size={18} />
        </button>
        <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />
        <button
          type="button"
          onClick={handlePrint}
          title="인쇄 / PDF 저장 (가로)"
          aria-label="인쇄 또는 PDF로 저장"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
        >
          <Printer size={18} />
        </button>
      </div>

      {/* 사용 설명서: 전체 dim + 컨트롤러만 보이게 + 설명 팝업 */}
      {helpOpen && (
        <>
          {/* 전체 화면 dim (클릭 시 닫힘). 컨트롤러(z-40)는 이 위로 보이지만 pointer-events-none 로 클릭 차단됨 */}
          <div
            className="absolute inset-0 z-30 bg-black/50"
            onClick={() => setHelpOpen(false)}
          />
          {/* 설명 팝업 (컨트롤러 위쪽) */}
          <div className="absolute bottom-16 left-3 z-40 w-[340px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                {help.icon}
              </span>
              <h3 className="text-sm font-bold text-slate-800">{help.title}</h3>
              <span className="ml-auto text-xs font-semibold text-slate-400">
                {helpPage + 1} / {helpPages.length}
              </span>
            </div>
            <ul className="mb-3 space-y-1.5">
              {help.lines.map((line, i) => (
                <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {/* 하단: 좌 / 닫기 / 우 */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setHelpPage((p) => Math.max(0, p - 1))}
                disabled={helpPage === 0}
                aria-label="이전"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => setHelpPage((p) => Math.min(helpPages.length - 1, p + 1))}
                disabled={helpPage === helpPages.length - 1}
                aria-label="다음"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* 스크롤 컨테이너: 스크롤바 숨김 + 그랩 팬 (좌하단 컨트롤과 분리되어 함께 스크롤되지 않음) */}
      <div
        ref={containerRef}
        onPointerDown={onPanStart}
        onPointerMove={onPanMove}
        onPointerUp={onPanEnd}
        onPointerLeave={onPanEnd}
        className={`h-full w-full overflow-auto rounded-xl border bg-white [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
      {/* 스크롤 래퍼: 내용이 작으면 가운데 정렬, 크면 시작 정렬로 폴백('safe')해 양방향 스크롤/팬 유지 */}
      <div className="flex min-h-full min-w-full p-4 items-center-safe justify-center-safe">
      <svg
        ref={svgRef}
        width={processedData.canvasSize.width * contentScale * zoom}
        height={processedData.canvasSize.height * contentScale * zoom}
        viewBox={`0 0 ${processedData.canvasSize.width} ${processedData.canvasSize.height}`}
        className="block shrink-0"
      >
        {/* A4 페이지 가이드라인 (내용 뒤에 배치, 인쇄 제외) */}
        {renderPageGuides()}
        {/* 전체 양수 변환이 끝났으므로 과도한 기본 마진 제거, 레이어 컨테이너 구성 */}
        <g >
          {renderRelationships()}
          
          {processedData.nodes.map((node) => {
            const { x, y } = node.layoutPosition;
            const isIP = node.attributes.is_ip;
            const nameLength = node.name.length;
            const estimatedWidth = Math.max(90, nameLength * 12);

            return (
              <g key={node.id} transform={`translate(${x}, ${y})`}>
                {/* 1. 도형/기호 (자녀 손실·임신 타입 우선, 그 외 성별) */}
                {node.type === 'fetus' ? (
                  // 임신: 작은 삼각형 (나이/기호가 들어가지 않으므로 작게)
                  <polygon points="0,-12 12,10 -12,10" fill="white" stroke="#475569" strokeWidth="2" />
                ) : node.type === 'stillbirth' ? (
                  // 사산: 임신과 동일 크기의 네모 + X
                  <g stroke="#475569" strokeWidth="2">
                    <rect x={-11} y={-11} width={22} height={22} fill="white" />
                    <line x1={-7} y1={-7} x2={7} y2={7} />
                    <line x1={7} y1={-7} x2={-7} y2={7} />
                  </g>
                ) : node.type === 'miscarriage' ? (
                  // 자연유산: 작은 채워진 원
                  <circle r={7} fill="#475569" stroke="#475569" strokeWidth="1" />
                ) : node.type === 'abortion' ? (
                  // 인공유산: 작은 X (유산 원과 비슷한 크기)
                  <g stroke="#475569" strokeWidth="2.5">
                    <line x1={-7} y1={-7} x2={7} y2={7} />
                    <line x1={7} y1={-7} x2={-7} y2={7} />
                  </g>
                ) : node.gender === 'male' ? (
                  <rect x={-25} y={-25} width={50} height={50} fill="white" stroke={isIP ? "#2563eb" : "#475569"} strokeWidth={isIP ? 3.5 : 2} />
                ) : node.gender === 'female' ? (
                  <circle r={25} fill="white" stroke={isIP ? "#2563eb" : "#475569"} strokeWidth={isIP ? 3.5 : 2} />
                ) : (
                  // 반려동물 또는 미지(마름모 기호)
                  <polygon points="0,-25 25,0 0,25 -25,0" fill="white" stroke="#475569" strokeWidth={2} />
                )}

                {/* 2. 사망 X: 일반 인물(person)만 (손실 기호는 자체 표기) */}
                {node.type === 'person' && node.attributes.is_deceased && (
                  <g stroke="#94a3b8" strokeWidth="2">
                    <line x1={-20} y1={-20} x2={20} y2={20} />
                    <line x1={20} y1={-20} x2={-20} y2={20} />
                  </g>
                )}

                {/* 3. 내담자(IP) 이중 테두리 기호 처리 (보웬 원칙 준수) */}
                {isIP && node.gender === 'male' && (
                  <rect x={-20} y={-20} width={40} height={40} fill="none" stroke="#2563eb" strokeWidth="1.5" />
                )}
                {isIP && node.gender === 'female' && (
                  <circle r={20} fill="none" stroke="#2563eb" strokeWidth="1.5" />
                )}

                {/* 3.5 출생연도(좌상단) · 사망연도(우상단) · 나이(중앙, 최상위) — 일반 인물만 */}
                {node.type === 'person' && (() => {
                  const yy = (s?: string) => {
                    if (!s) return '';
                    const m4 = String(s).match(/\d{4}/);
                    if (m4) return m4[0].slice(-2);
                    const m2 = String(s).match(/\d{2}/);
                    return m2 ? m2[0] : '';
                  };
                  let by = yy(node.attributes.birth_date);
                  // 폴백: 출생연도 데이터가 없으면 나이로 추정 (현재 연도 - 나이)
                  if (!by && node.attributes.age != null) {
                    by = yy(String(new Date().getFullYear() - node.attributes.age));
                  }
                  const dy = yy(node.attributes.death_date);
                  const showAge = node.attributes.age != null;
                  return (
                    <>
                      {by ? (
                        <text x={-28} y={-30} textAnchor="end" fontSize="10" fontWeight={600} fill="#64748b">{by}</text>
                      ) : null}
                      {dy ? (
                        <text x={28} y={-30} textAnchor="start" fontSize="10" fontWeight={600} fill="#64748b">{dy}</text>
                      ) : null}
                      {/* 나이: 건강 색칠(배경) 위에 겹쳐 보이도록 최상위에 배치 */}
                      {showAge ? (
                        <text x={0} y={6} textAnchor="middle" fontSize="15" fontWeight={700} fill="#0f172a">{node.attributes.age}</text>
                      ) : null}
                    </>
                  );
                })()}

                {/* 4. 하단 텍스트 이름표 및 출생 순위 라벨링 */}
                {(() => {
                  const nameText = `${node.name}${node.attributes.birth_order ? ` (${node.attributes.birth_order}째)` : ''}`;
                  const nameLength = nameText.length;
                  
                  // 글자 수에 따라 동적으로 가로 폭을 계산하되, 최소 100px에서 최대 160px 사이로 제한합니다.
                  const dynamicBoxWidth = Math.min(120, Math.max(100, nameLength * 11));
                  
                  // 말줄임(truncate)을 제거하고, 글자가 길어지면 아래로 늘어날 수 있도록 높이를 넉넉히(80px) 잡습니다.
                  return (
                    <foreignObject 
                      x={-(dynamicBoxWidth / 2)} 
                      y={32} 
                      width={dynamicBoxWidth} 
                      height={80} // 2~3줄 줄바꿈을 대비해 높이를 확장
                    >
                      <div className="w-full text-[11px] text-center font-semibold leading-tight text-black flex justify-center">
                        <span className="border bg-slate-50 border-slate-200 shadow-sm px-2 py-1 block rounded w-full break-all whitespace-normal">
                          {node.name}
                          {node.attributes.birth_order && (
                            <span className="text-slate-500 font-normal block mt-0.5">
                              ({node.attributes.birth_order}째)
                            </span>
                          )}
                        </span>
                      </div>
                    </foreignObject>
                  );
                })()}
              </g>
            );
          })}
        </g>
      </svg>
      </div>
      </div>
    </div>
  );
}
