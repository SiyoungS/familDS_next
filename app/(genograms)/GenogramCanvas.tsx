'use client';

import { calculateGenogramLayout } from '@/lib/genograms/bowen/calculator-nodes';
import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';
import { resolveAnonymousNames, removeNodesFromData } from '@/lib/genograms/bowen/prune-anonymous';
import { arcPath, arcZigzag, emotionalBow, edgeEndpoints, arcControl, axis } from '@/lib/genograms/bowen/edge-geometry';
import type { GeoNode } from '@/lib/genograms/bowen/edge-geometry';
import { BWGenogramData, PersonNode, ChildGroup } from '@/types/bowengenogram.types';
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Printer, Maximize, Frame, Scaling, Plus, Minus, HelpCircle, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

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

// 나이 표기 방식: 만 나이(actual, 기본) / 연 나이(calendar) / 한국식 나이(korean)
type AgeMode = 'actual' | 'calendar' | 'korean';

// 'IP의 현재 배우자' 판정: is_spouse_of_ip 우선, 없으면 IP 결혼 유닛 중 marriage_order 최댓값의 상대.
// (reorder-nodes.ts의 '현재 배우자' 판정 규칙과 동일한 기준을 데이터 필터 단계에서도 재사용)
function findCurrentSpouse(data: BWGenogramData): PersonNode | null {
  const nodes = data.nodes || [];
  const ip = nodes.find((n) => n.attributes?.is_ip);
  if (!ip) return null;
  const spouseFlagged = nodes.find((n) => n.attributes?.is_spouse_of_ip);
  if (spouseFlagged) return spouseFlagged;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const ipSpouses = (data.familyUnits || [])
    .filter((fu) => fu.parent_ids.includes(ip.id))
    .map((fu) => ({
      order: fu.marriage_order || 0,
      node: nodeMap.get(fu.parent_ids.find((pId) => pId !== ip.id) || ''),
    }))
    .filter((x): x is { order: number; node: PersonNode } => !!x.node)
    .sort((a, b) => a.order - b.order)
    .map((x) => x.node);

  return ipSpouses.length > 0 ? ipSpouses[ipSpouses.length - 1] : null;
}

// '친정 부모(배우자 측) 표시' 필터용: 현재 배우자가 child로 속한 원가족 유닛의 parent_ids를
// 시작점으로, 그 원가족 유닛의 child_ids로는 내려가지 않는 조건으로(=배우자 본인과 배우자의
// 형제자매는 순회 대상에서 제외) 가족 그래프(유닛 멤버십)를 따라 도달 가능한 모든 노드를 모은다.
function collectSpouseParentFamilyIds(data: BWGenogramData): Set<string> {
  const removed = new Set<string>();
  const spouse = findCurrentSpouse(data);
  if (!spouse) return removed;

  const units = data.familyUnits || [];
  const originUnit = units.find((fu) => fu.childGroups?.some((cg) => cg.child_ids.includes(spouse.id)));
  if (!originUnit || (originUnit.parent_ids || []).length === 0) return removed;

  // 배우자의 원가족 유닛만 제외한 노드-노드 인접 그래프 구성(유닛 멤버 = 서로 연결된 clique).
  // 이렇게 하면 시작점(배우자의 부모)에서 출발한 순회가 그 유닛의 자녀(배우자·배우자 형제) 쪽으로
  // 다시 내려가지 않는다.
  const adj = new Map<string, Set<string>>();
  const ensure = (id: string) => {
    if (!adj.has(id)) adj.set(id, new Set());
    return adj.get(id)!;
  };
  units.forEach((unit) => {
    if (unit.id === originUnit.id) return;
    const memberIds = new Set<string>([
      ...(unit.parent_ids || []),
      ...(unit.childGroups || []).flatMap((cg) => cg.child_ids),
    ]);
    const members = Array.from(memberIds);
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        ensure(members[i]).add(members[j]);
        ensure(members[j]).add(members[i]);
      }
    }
  });

  const queue: string[] = [...originUnit.parent_ids];
  const visited = new Set<string>(queue);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    adj.get(cur)?.forEach((next) => {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    });
  }
  visited.forEach((id) => removed.add(id));
  return removed;
}

// '친정 부모(배우자 측) 표시' 토글이 꺼져 있을 때(기본) 적용하는 데이터 필터.
// 배우자의 부모와 그 윗세대 전체를 제거하고, 유닛/링크/households 정리는
// prune-anonymous.ts의 removeNodesFromData를 그대로 재사용한다.
function filterSpouseParentFamily(data: BWGenogramData): BWGenogramData {
  const ids = collectSpouseParentFamilyIds(data);
  if (ids.size === 0) return data;
  return removeNodesFromData(data, ids);
}

// 나이 표기 계산: 만 나이(actual, 기본) / 연 나이(calendar) / 한국식 나이(korean). 결과 없으면 null.
function displayAge(node: PersonNode, mode: AgeMode, thisYear: number): number | null {
  const birthDateStr = node.attributes.birth_date;
  const birthYearMatch = birthDateStr ? String(birthDateStr).match(/\d{4}/) : null;
  const birthYear = birthYearMatch ? Number(birthYearMatch[0]) : null;
  const age = node.attributes.age;

  if (mode === 'calendar') {
    // 연나이 = thisYear - birthYear (있을 때), 없으면 age 폴백
    return birthYear != null ? thisYear - birthYear : (age ?? null);
  }
  if (mode === 'korean') {
    // 한국나이 = 연나이 + 1 (birthYear 있을 때), 없으면 age + 1
    if (birthYear != null) return thisYear - birthYear + 1;
    return age != null ? age + 1 : null;
  }
  // 만나이(기본): age가 있으면 그대로(LLM이 만 나이 기준으로 추출), 없으면
  // birth_date가 yyyy.MM.dd 전체 날짜면 정확 계산, 연도만 있으면 thisYear - birthYear
  if (age != null) return age;
  if (birthDateStr) {
    const fullMatch = String(birthDateStr).match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (fullMatch) {
      const [, y, m, d] = fullMatch;
      const birth = new Date(Number(y), Number(m) - 1, Number(d));
      const now = new Date();
      let a = now.getFullYear() - birth.getFullYear();
      const hadBirthdayThisYear =
        now.getMonth() > birth.getMonth() ||
        (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
      if (!hadBirthdayThisYear) a -= 1;
      return a;
    }
    if (birthYear != null) return thisYear - birthYear;
  }
  return null;
}

// 계단형 다각형(오목 코너 포함)의 각 꼭짓점을 라운드 처리한 SVG path 문자열을 만든다.
// 코너 반경은 인접한 두 변 길이의 절반을 넘지 않도록 클램프해 자기교차를 방지한다.
function roundedPolygonPath(points: { x: number; y: number }[], radius: number): string {
  const n = points.length;
  if (n < 3) return '';
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  const segs: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const dPrev = dist(prev, cur);
    const dNext = dist(cur, next);
    const r = dPrev > 0 && dNext > 0 ? Math.max(0, Math.min(radius, dPrev / 2, dNext / 2)) : 0;
    const startPt = r > 0 ? lerp(cur, prev, r / dPrev) : cur;
    const endPt = r > 0 ? lerp(cur, next, r / dNext) : cur;
    segs.push(i === 0 ? `M ${startPt.x} ${startPt.y}` : `L ${startPt.x} ${startPt.y}`);
    if (r > 0) segs.push(`Q ${cur.x} ${cur.y} ${endPt.x} ${endPt.y}`);
  }
  segs.push('Z');
  return segs.join(' ');
}

export default function GenogramCanvas({ data: initialData }: Props) {
  // 친정 부모(배우자 측) 표시 — 기본 OFF(생략). IP에게 배우자가 없으면 토글은 무의미.
  const [showSpouseFamily, setShowSpouseFamily] = useState(false);
  // 인물 텍스트(이름·나이) 표시 — 기본 OFF.
  const [showLabels, setShowLabels] = useState(false);
  // 출생 나이 표시 — 기본 ON. showLabels의 하위 옵션.
  const [showAgeInLabel, setShowAgeInLabel] = useState(true);
  // 출생 서열(N째) 표시 — 기본 OFF. showLabels의 하위 옵션.
  const [showBirthOrder, setShowBirthOrder] = useState(false);
  // 나이 표기 방식 — 기본 만 나이. showLabels의 하위 옵션.
  const [ageMode, setAgeMode] = useState<AgeMode>('actual');
  // 표시 옵션 팝오버
  const [optionsOpen, setOptionsOpen] = useState(false);

  const hasSpouse = useMemo(() => !!findCurrentSpouse(initialData), [initialData]);

  // 1. (필요시) 친정 부모 측 필터 → 익명 이름을 관계 지칭으로 변환 → 순서 재정렬 → 물리적인 양수 좌표 및 캔버스 크기 최종 산출
  // 토글 ON: 필터 없음(친정 부모+윗세대 포함 전부 표시).
  // 토글 OFF(기본): 배우자 측 부모+윗세대 서브트리 전체 제거(익명 여부 무관, 기존 그대로).
  const processedData = useMemo(() => {
    const base = showSpouseFamily ? initialData : filterSpouseParentFamily(initialData);
    const resolved = resolveAnonymousNames(base);
    const ordered = reorderDisplayOrders(resolved);
    return calculateGenogramLayout(ordered);
  }, [initialData, showSpouseFamily]);

  // 확대/축소 상태 (1 = 100%) — 화면 보기 전용, 인쇄에는 미반영
  const [zoom, setZoom] = useState(1);
  // 출력 배율(도형 크기, 1 = 100%) — 실제 출력 크기, 인쇄 페이지 수/가이드에 반영
  const [contentScale, setContentScale] = useState(1);
  // A4 페이지 가이드라인 표시 여부 (인쇄에는 나오지 않음) — 기본 비표시
  const [showGuide, setShowGuide] = useState(false);
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
      const parents = unit.parent_ids
        .map(id => ({
          id,
          pos: nodePositions[id],
          node: processedData.nodes.find(n => n.id === id)
        }))
        // 좌표 있는 부모만(친정 부모 필터 등으로 제거된 부모는 좌표가 없음)
        .filter(p => !!p.pos);

      // 부모가 0명(둘 다 없음)인 유닛: 자녀가 2명 이상이면 형제 바만 그리고 종료.
      if (parents.length === 0) {
        const childIds = (unit.childGroups || []).flatMap(g => g.child_ids);
        const childNodesForBar = childIds
          .map(id => ({ id, pos: nodePositions[id], node: processedData.nodes.find(n => n.id === id) }))
          .filter((c): c is { id: string; pos: { x: number; y: number }; node: PersonNode } => !!c.pos && !!c.node);

        if (childNodesForBar.length >= 2) {
          const xs = childNodesForBar.map(c => c.pos.x);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const barY = Math.min(...childNodesForBar.map(c => c.pos.y)) - 75;

          elements.push(
            <line
              key={`orphan-bar-${unit.id}-${idx}`}
              x1={minX} y1={barY} x2={maxX} y2={barY}
              stroke="#333"
              strokeWidth="2"
            />
          );
          childNodesForBar.forEach((c, cIdx) => {
            const top = c.node.type === 'person' ? 25 : (c.node.type === 'fetus' || c.node.type === 'stillbirth') ? 12 : 8;
            elements.push(
              <line
                key={`orphan-v-${unit.id}-${idx}-${cIdx}`}
                x1={c.pos.x} y1={barY} x2={c.pos.x} y2={c.pos.y - top}
                stroke="#333"
                strokeWidth="2"
              />
            );
          });
        }
        return; // 자녀 1명 이하면 그리지 않고 종료(기존과 동일)
      }

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

  // 정서 오버레이용 심볼 반지름 헬퍼 (구조 렌더링과 동일 기준)
  const radiusOf = (node: PersonNode): number => {
    if (node.type === 'person') return 25;
    if (node.type === 'fetus' || node.type === 'stillbirth') return 12;
    if (node.type === 'miscarriage' || node.type === 'abortion') return 8;
    return 25;
  };

  // 동거가족(household) 범위 표시 — 배경 레이어(구조 뒤)
  // 단일 사각형은 가장 넓은 줄 기준으로 퍼져서 다른 줄의 비구성원 노드까지 가두는 문제가 있음.
  // → 비구성원 노드가 경계에 갇히지 않도록 세대(줄)별 폭에 맞춘 계단형 외곽선(단일 닫힌 path)을 그린다.
  const renderHouseholds = (): React.JSX.Element[] => {
    const elements: React.JSX.Element[] = [];
    const households = processedData.households ?? [];
    const ip = processedData.nodes.find((n) => n.attributes?.is_ip);
    households.forEach((h, idx) => {
      const memberIds = h.member_ids ?? h.members ?? [];
      // IP(내담자) 가족만 표시 — 그 외 동거가족은 추후 다른 인물 기준 표시 기능에서 다룰 예정
      if (!ip || !memberIds.includes(ip.id)) return;
      // 구성원별 좌표 수집 — 좌표가 없으면 해당 구성원 스킵
      const members = memberIds
        .map((id) => {
          const node = processedData.nodes.find((n) => n.id === id);
          const pos = nodePositions[id];
          return node && pos ? { x: pos.x, y: pos.y } : null;
        })
        .filter((m): m is { x: number; y: number } => !!m);
      if (members.length < 1) return;

      // 실제 y값(줄)별로 묶어 줄 단위 범위 계산 — 같은 세대(relLevel)도 subRow로 y가
      // 2종(150px 차이)일 수 있으므로 relLevel이 아닌 y값 자체를 그룹 키로 쓴다.
      const byRowY = new Map<number, { x: number; y: number }[]>();
      members.forEach((m) => {
        const group = byRowY.get(m.y) ?? [];
        group.push({ x: m.x, y: m.y });
        byRowY.set(m.y, group);
      });
      // 심볼 반지름(25) + 심볼 아래 이름표(≈60) + 패딩(32) 포함해 확장
      const rows = [...byRowY.values()]
        .map((group) => {
          const xs = group.map((p) => p.x);
          const ys = group.map((p) => p.y);
          return {
            left: Math.min(...xs) - 25 - 32,
            right: Math.max(...xs) + 25 + 32,
            top: Math.min(...ys) - 25 - 32,
            bottom: Math.max(...ys) + 25 + 60 + 32,
          };
        })
        .sort((a, b) => a.top - b.top); // 윗세대(작은 y) 줄부터

      // 인접 줄 사이 경계 y = 두 줄 사이의 중간값 — 틈/겹침 없이 단일 다각형으로 연결
      const boundaryY = (i: number) => (rows[i].bottom + rows[i + 1].top) / 2;
      const n = rows.length;
      const pts: { x: number; y: number }[] = [
        { x: rows[0].left, y: rows[0].top },
        { x: rows[0].right, y: rows[0].top },
      ];
      // 오른쪽 변: 위에서 아래로 줄 폭에 맞춰 계단 이동
      for (let i = 0; i < n - 1; i++) {
        pts.push({ x: rows[i].right, y: boundaryY(i) });
        pts.push({ x: rows[i + 1].right, y: boundaryY(i) });
      }
      pts.push({ x: rows[n - 1].right, y: rows[n - 1].bottom });
      pts.push({ x: rows[n - 1].left, y: rows[n - 1].bottom });
      // 왼쪽 변: 아래에서 위로 줄 폭에 맞춰 계단 이동
      for (let i = n - 1; i >= 1; i--) {
        pts.push({ x: rows[i].left, y: boundaryY(i - 1) });
        pts.push({ x: rows[i - 1].left, y: boundaryY(i - 1) });
      }

      elements.push(
        <path
          key={`hh-${h.id ?? idx}`}
          // '소원' 정서선(#94a3b8, 5 5 점선)과 구분: 진한 색 + 큰 라운드 코너 + 촘촘한 dot 패턴.
          d={roundedPolygonPath(pts, 36)}
          fill="none"
          stroke="#475569"
          strokeWidth={1.5}
          // 자료 기준: 동거가족 경계는 항상 점선 (LLM이 stroke_style을 'solid'로 줘도 무시)
          // 점 크기 0.5(+둥근 캡) 유지, 간격 6 = 점 2개 분량의 공백 (round 캡이 양쪽 0.75씩 잠식)
          strokeDasharray="0.5 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      if (h.label) {
        elements.push(
          <text
            key={`hh-label-${h.id ?? idx}`}
            x={rows[0].left + 8}
            y={rows[0].top - 6}
            fontSize={11}
            fontWeight={600}
            fill="#475569"
          >
            {h.label}
          </text>
        );
      }
    });
    return elements;
  };

  // 정서 관계선 오버레이 — 최상위(구조 위)
  const renderEmotionalLinks = (): React.JSX.Element[] => {
    const elements: React.JSX.Element[] = [];
    const links = processedData.links ?? [];
    const seen = new Set<string>();
    // 회피 곡률 계산용 전체 노드 GeoNode
    const allNodes: GeoNode[] = processedData.nodes.map((n) => ({
      x: n.layoutPosition.x,
      y: n.layoutPosition.y,
      r: radiusOf(n),
    }));

    links.forEach((link, idx) => {
      const dedupeKey = [link.from, link.to].sort().join('|');
      if (seen.has(dedupeKey)) return; // 첫 등장만 유지
      seen.add(dedupeKey);

      const status = link.emotional_status;
      if (status === 'normal' || status === 'triangle') return; // 그리지 않음

      const fromPos = nodePositions[link.from];
      const toPos = nodePositions[link.to];
      if (!fromPos || !toPos) return; // 좌표 없으면 스킵

      const fromNode = processedData.nodes.find((n) => n.id === link.from);
      const toNode = processedData.nodes.find((n) => n.id === link.to);
      if (!fromNode || !toNode) return;

      const fromGeo: GeoNode = { x: fromPos.x, y: fromPos.y, r: radiusOf(fromNode) };
      const toGeo: GeoNode = { x: toPos.x, y: toPos.y, r: radiusOf(toNode) };

      const bow = emotionalBow(fromGeo, toGeo, allNodes);
      const { x1, y1, x2, y2 } = edgeEndpoints(fromGeo, toGeo);

      switch (status) {
        case 'close': // 친밀: 이중 평행 호
          elements.push(
            <path key={`emo-${idx}-a`} d={arcPath(x1, y1, x2, y2, bow, 2.5)} fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" />,
            <path key={`emo-${idx}-b`} d={arcPath(x1, y1, x2, y2, bow, -2.5)} fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" />
          );
          break;
        case 'fused': // 밀착: 삼중 평행 호
          elements.push(
            <path key={`emo-${idx}-a`} d={arcPath(x1, y1, x2, y2, bow, 0)} fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" />,
            <path key={`emo-${idx}-b`} d={arcPath(x1, y1, x2, y2, bow, 4)} fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" />,
            <path key={`emo-${idx}-c`} d={arcPath(x1, y1, x2, y2, bow, -4)} fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" />
          );
          break;
        case 'distant': // 소원: 가는 점선 호
          elements.push(
            <path key={`emo-${idx}`} d={arcPath(x1, y1, x2, y2, bow, 0)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="5 5" />
          );
          break;
        case 'conflictual': // 갈등: 지그재그 호
          elements.push(
            <path key={`emo-${idx}`} d={arcZigzag(x1, y1, x2, y2, bow, 5, 12)} fill="none" stroke="#dc2626" strokeWidth={1.5} strokeLinecap="round" />
          );
          break;
        case 'fused_conflictual': // 밀착된 갈등: 삼중 녹색 호 + 위에 빨강 지그재그
          elements.push(
            <path key={`emo-${idx}-a`} d={arcPath(x1, y1, x2, y2, bow, 0)} fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" />,
            <path key={`emo-${idx}-b`} d={arcPath(x1, y1, x2, y2, bow, 4)} fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" />,
            <path key={`emo-${idx}-c`} d={arcPath(x1, y1, x2, y2, bow, -4)} fill="none" stroke="#059669" strokeWidth={1.5} strokeLinecap="round" />,
            <path key={`emo-${idx}-z`} d={arcZigzag(x1, y1, x2, y2, bow, 5, 12)} fill="none" stroke="#dc2626" strokeWidth={1.5} strokeLinecap="round" />
          );
          break;
        case 'hostile': // 적대: 굵은 지그재그
          elements.push(
            <path key={`emo-${idx}`} d={arcZigzag(x1, y1, x2, y2, bow, 7, 10)} fill="none" stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" />
          );
          break;
        case 'cut_off': { // 단절: 연속 호 1개 + 중점 접선에 수직 막대 2개(-||-)
          elements.push(
            <path key={`emo-${idx}-arc`} d={arcPath(x1, y1, x2, y2, bow, 0)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" />
          );
          const { cx, cy } = arcControl(x1, y1, x2, y2, bow);
          const Bx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
          const By = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
          const { ux, uy, nx, ny } = axis(x1, y1, x2, y2); // nx,ny = 단위 법선
          const b = 7;
          const bar = (o: number) =>
            `M ${Bx + ux * o + nx * b} ${By + uy * o + ny * b} L ${Bx + ux * o - nx * b} ${By + uy * o - ny * b}`;
          elements.push(
            <path key={`emo-${idx}-bar1`} d={bar(-5)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" />,
            <path key={`emo-${idx}-bar2`} d={bar(5)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" />
          );
          break;
        }
        default:
          break;
      }
    });

    return elements;
  };

  // 범례 — 사용된 정서선 유형/동거가족 유무에 따라 좌상단에 표시 (인쇄 포함)
  const renderLegend = (): React.JSX.Element | null => {
    const links = processedData.links ?? [];
    const seen = new Set<string>();
    const used = new Set<string>();
    links.forEach((link) => {
      const dedupeKey = [link.from, link.to].sort().join('|');
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const s = link.emotional_status;
      if (s === 'normal' || s === 'triangle') return;
      if (!nodePositions[link.from] || !nodePositions[link.to]) return;
      used.add(s);
    });
    const hasHouseholds = (processedData.households ?? []).some((h) => {
      const memberIds = h.member_ids ?? h.members ?? [];
      return memberIds.filter((id) => nodePositions[id]).length >= 1;
    });
    if (used.size === 0 && !hasHouseholds) return null;

    const ORDER: { key: string; label: string }[] = [
      { key: 'close', label: '친밀' },
      { key: 'fused', label: '밀착' },
      { key: 'distant', label: '소원' },
      { key: 'conflictual', label: '갈등' },
      { key: 'fused_conflictual', label: '밀착된 갈등' },
      { key: 'cut_off', label: '단절' },
      { key: 'hostile', label: '적대' },
    ];
    const rows = ORDER.filter((r) => used.has(r.key));
    if (hasHouseholds) rows.push({ key: 'household', label: '동거가족' });

    const x0 = 16;
    const y0 = 16;
    const pad = 10;
    const rowHeight = 20;
    const boxWidth = 150;
    const boxHeight = pad * 2 + rows.length * rowHeight;
    const sx = x0 + pad; // 샘플 시작 x
    const sw = 28; // 샘플 폭
    const labelX = sx + sw + 6;

    // 작은 지그재그 폴리라인 포인트 생성(직선 기반 샘플)
    const zig = (cy: number, amp: number, segs: number) => {
      const pts: string[] = [];
      for (let i = 0; i <= segs; i++) {
        const px = sx + (sw * i) / segs;
        const s = i === 0 || i === segs ? 0 : i % 2 ? -amp : amp;
        pts.push(`${px},${cy + s}`);
      }
      return pts.join(' ');
    };

    const sample = (key: string, cy: number): React.JSX.Element[] => {
      switch (key) {
        case 'close':
          return [
            <line key="s1" x1={sx} y1={cy - 2} x2={sx + sw} y2={cy - 2} stroke="#059669" strokeWidth={1.5} />,
            <line key="s2" x1={sx} y1={cy + 2} x2={sx + sw} y2={cy + 2} stroke="#059669" strokeWidth={1.5} />,
          ];
        case 'fused':
          return [
            <line key="s1" x1={sx} y1={cy - 3} x2={sx + sw} y2={cy - 3} stroke="#059669" strokeWidth={1.5} />,
            <line key="s2" x1={sx} y1={cy} x2={sx + sw} y2={cy} stroke="#059669" strokeWidth={1.5} />,
            <line key="s3" x1={sx} y1={cy + 3} x2={sx + sw} y2={cy + 3} stroke="#059669" strokeWidth={1.5} />,
          ];
        case 'distant':
          return [
            <line key="s1" x1={sx} y1={cy} x2={sx + sw} y2={cy} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" />,
          ];
        case 'conflictual':
          return [
            <polyline key="s1" points={zig(cy, 4, 6)} fill="none" stroke="#dc2626" strokeWidth={1.5} />,
          ];
        case 'fused_conflictual':
          return [
            <line key="s1" x1={sx} y1={cy - 3} x2={sx + sw} y2={cy - 3} stroke="#059669" strokeWidth={1.5} />,
            <line key="s2" x1={sx} y1={cy} x2={sx + sw} y2={cy} stroke="#059669" strokeWidth={1.5} />,
            <line key="s3" x1={sx} y1={cy + 3} x2={sx + sw} y2={cy + 3} stroke="#059669" strokeWidth={1.5} />,
            <polyline key="s4" points={zig(cy, 4, 6)} fill="none" stroke="#dc2626" strokeWidth={1.5} />,
          ];
        case 'cut_off':
          return [
            <line key="s1" x1={sx} y1={cy} x2={sx + sw} y2={cy} stroke="#94a3b8" strokeWidth={1.5} />,
            <line key="s2" x1={sx + sw / 2 - 4} y1={cy - 5} x2={sx + sw / 2 - 4} y2={cy + 5} stroke="#94a3b8" strokeWidth={1.5} />,
            <line key="s3" x1={sx + sw / 2 + 4} y1={cy - 5} x2={sx + sw / 2 + 4} y2={cy + 5} stroke="#94a3b8" strokeWidth={1.5} />,
          ];
        case 'hostile':
          return [
            <polyline key="s1" points={zig(cy, 6, 6)} fill="none" stroke="#dc2626" strokeWidth={2.5} />,
          ];
        case 'household':
          return [
            <rect key="s1" x={sx} y={cy - 6} width={sw} height={12} rx={6} fill="none" stroke="#475569" strokeWidth={1.5} strokeDasharray="0.5 6" strokeLinecap="round" />,
          ];
        default:
          return [];
      }
    };

    return (
      <g>
        <rect x={x0} y={y0} width={boxWidth} height={boxHeight} rx={8} fill="#ffffff" fillOpacity={0.92} stroke="#e2e8f0" strokeWidth={1} />
        {rows.map((r, i) => {
          const cy = y0 + pad + i * rowHeight + rowHeight / 2;
          return (
            <g key={`legend-${r.key}`}>
              {sample(r.key, cy)}
              <text x={labelX} y={cy + 4} fontSize={11} fill="#334155">
                {r.label}
              </text>
            </g>
          );
        })}
      </g>
    );
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
      <div className={`absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 p-1 shadow-md backdrop-blur ${(helpOpen || optionsOpen) ? 'z-40 pointer-events-none' : 'z-20'}`}>
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
        <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />
        {/* 표시 옵션(친정 부모 표시 / 출생 서열 / 나이 표기 방식) */}
        <button
          type="button"
          onClick={() => setOptionsOpen((v) => !v)}
          title="표시 옵션"
          aria-label="표시 옵션 열기"
          aria-pressed={optionsOpen}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100 ${optionsOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
        >
          <SlidersHorizontal size={18} />
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

      {/* 표시 옵션: 전체 dim + 컨트롤러만 보이게 + 옵션 팝오버 (사용 설명서와 동일한 스타일 계열) */}
      {optionsOpen && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/50"
            onClick={() => setOptionsOpen(false)}
          />
          <div className="absolute bottom-16 right-3 z-40 w-[300px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <SlidersHorizontal size={18} />
              </span>
              <h3 className="text-sm font-bold text-slate-800">표시 옵션</h3>
              <button
                type="button"
                onClick={() => setOptionsOpen(false)}
                className="ml-auto rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900"
              >
                닫기
              </button>
            </div>

            <div className="space-y-3">
              {/* 인물 텍스트(이름·나이) 표시 — 기본 OFF. 아래 세 항목은 이 옵션의 하위(포함) 옵션 */}
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                <span>인물 텍스트(이름·나이) 표시</span>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>

              {/* 인물 텍스트 하위 옵션: showLabels가 꺼지면 전부 비활성화 */}
              <div className="ml-3 space-y-2 border-l-2 border-slate-100 pl-3">
                {/* a) 출생 나이 표시 — 기본 ON */}
                <label
                  className={`flex items-center justify-between gap-2 text-xs font-semibold ${
                    showLabels ? 'text-slate-700 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span>출생 나이 표시</span>
                  <input
                    type="checkbox"
                    checked={showAgeInLabel}
                    disabled={!showLabels}
                    onChange={(e) => setShowAgeInLabel(e.target.checked)}
                    className="h-4 w-4 accent-blue-600 disabled:opacity-40"
                  />
                </label>

                {/* b) 나이 표기 방식 — 만 나이(기본) / 연 나이 / 한국식 나이. showLabels 또는 showAgeInLabel이 꺼지면 비활성화 */}
                <div>
                  <div
                    className={`mb-1 text-xs font-semibold ${
                      showLabels && showAgeInLabel ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    나이 표기 방식
                  </div>
                  <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                    {(
                      [
                        { key: 'actual', label: '만 나이' },
                        { key: 'calendar', label: '연 나이' },
                        { key: 'korean', label: '한국식 나이' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={!showLabels || !showAgeInLabel}
                        onClick={() => setAgeMode(opt.key)}
                        className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                          !showLabels || !showAgeInLabel
                            ? 'text-slate-300 cursor-not-allowed'
                            : ageMode === opt.key
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* c) 출생 서열(N째) 표시 — 기본 OFF */}
                <label
                  className={`flex items-center justify-between gap-2 text-xs font-semibold ${
                    showLabels ? 'text-slate-700 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span>출생 서열(N째) 표시</span>
                  <input
                    type="checkbox"
                    checked={showBirthOrder}
                    disabled={!showLabels}
                    onChange={(e) => setShowBirthOrder(e.target.checked)}
                    className="h-4 w-4 accent-blue-600 disabled:opacity-40"
                  />
                </label>
              </div>

              {/* 친정 부모(배우자 측) 표시 — 기본 OFF, 배우자가 없으면 비활성화. showLabels와 무관한 별도 옵션 */}
              <label
                className={`flex items-center justify-between gap-2 text-xs font-semibold ${
                  hasSpouse ? 'text-slate-700 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
                }`}
              >
                <span>친정 부모(배우자 측) 표시</span>
                <input
                  type="checkbox"
                  checked={showSpouseFamily}
                  disabled={!hasSpouse}
                  onChange={(e) => setShowSpouseFamily(e.target.checked)}
                  className="h-4 w-4 accent-blue-600 disabled:opacity-40"
                />
              </label>
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
          {renderHouseholds()}
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

                {/* 3.5 출생연도(좌상단) · 사망연도(우상단) — 일반 인물만 */}
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
                  return (
                    <>
                      {by ? (
                        <text x={-28} y={-30} textAnchor="end" fontSize="10" fontWeight={600} fill="#64748b">{by}</text>
                      ) : null}
                      {dy ? (
                        <text x={28} y={-30} textAnchor="start" fontSize="10" fontWeight={600} fill="#64748b">{dy}</text>
                      ) : null}
                    </>
                  );
                })()}

                {/* 4. 하단 텍스트 이름표 및 출생 순위·나이 라벨링 */}
                {(() => {
                  if (!showLabels) return null;
                  // 유지된 익명 구조 연결자(name === '')는 라벨 전체를 생략(빈 도형만 유지)
                  if (!node.name?.trim()) return null;

                  const rawBirthOrder = node.attributes.birth_order;
                  const birthOrder = Number.isInteger(rawBirthOrder) && rawBirthOrder >= 1 ? rawBirthOrder : null;
                  const showOrder = showBirthOrder && birthOrder != null;
                  // 나이(displayAge() 기준) — 일반 인물(person)만 표기 대상, 출생 나이 표시 토글이 꺼지면 생략
                  const ageValue = showAgeInLabel && node.type === 'person' ? displayAge(node, ageMode, new Date().getFullYear()) : null;
                  const hasAge = ageValue != null;

                  // 서열/나이 결합 괄호 표기: 서열ON+나이있음 "(N째/M세)" / 서열OFF+나이있음 "(M세)" /
                  // 서열ON+나이없음 "(N째)" / 둘 다 없으면 괄호 줄 생략
                  const bracketText = showOrder && hasAge
                    ? `(${birthOrder}째/${ageValue}세)`
                    : hasAge
                      ? `(${ageValue}세)`
                      : showOrder
                        ? `(${birthOrder}째)`
                        : '';
                  const nameText = `${node.name}${bracketText ? ` ${bracketText}` : ''}`;
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
                          {bracketText && (
                            <span className="text-slate-500 font-normal block mt-0.5">
                              {bracketText}
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
          {renderEmotionalLinks()}
          {renderLegend()}
        </g>
      </svg>
      </div>
      </div>
    </div>
  );
}
