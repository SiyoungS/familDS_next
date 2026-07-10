/**
 * Bowen 정서 관계선(emotional relationship line) 렌더링용 순수 기하 헬퍼.
 *
 * 좌표계는 SVG 좌표계로 +y가 아래를 향합니다. 따라서 "위로 볼록(upward convex)"이란
 * 호(arc)가 더 작은 y 쪽으로 부풀어 오르는 것을 의미합니다.
 * 심볼 중심은 노드의 layoutPosition이며, person 심볼 반지름은 25px입니다.
 *
 * React나 프로젝트 모듈에 의존하지 않는 순수 수학 모듈입니다.
 * (design doc §7.1 / §7.3 참조)
 */

/** 심볼 중심 좌표 + 반지름 */
export interface GeoNode {
  x: number;
  y: number;
  r: number;
}

/**
 * 두 점 사이의 방향/법선 단위 벡터와 현(chord) 길이를 계산한다.
 * - ux,uy: 방향 단위 벡터
 * - nx,ny: 법선 단위 벡터
 * - len: 현 길이(0 방지용으로 최소 1)
 */
export function axis(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { ux: number; uy: number; nx: number; ny: number; len: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -dy / len;
  const ny = dx / len;
  return { ux, uy, nx, ny, len };
}

/**
 * 항상 위로 볼록한 2차 베지어 호의 제어점을 계산한다.
 * 법선의 ny가 양수(아래쪽)면 뒤집어 위쪽(ny<=0)을 향하게 만든다.
 */
export function arcControl(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow: number,
): { cx: number; cy: number; nx: number; ny: number } {
  let { nx, ny } = axis(x1, y1, x2, y2);
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (x1 + x2) / 2 + nx * bow;
  const cy = (y1 + y2) / 2 + ny * bow;
  return { cx, cy, nx, ny };
}

/** 현 길이로부터 기본 곡률을 구한다: clamp(len*0.18, 28, 70) */
export function arcBow(len: number): number {
  return Math.min(70, Math.max(28, len * 0.18));
}

/**
 * 호에 대한 SVG path("M .. Q ..")를 만든다.
 * off를 주면 (위쪽) 법선 방향으로 평행 이동하여 이중/삼중 평행선을 그릴 수 있다.
 */
export function arcPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow: number,
  off = 0,
): string {
  const { cx, cy, nx, ny } = arcControl(x1, y1, x2, y2, bow);
  return `M ${x1 + nx * off} ${y1 + ny * off} Q ${cx + nx * off} ${cy + ny * off} ${x2 + nx * off} ${y2 + ny * off}`;
}

/**
 * 호를 따라 표본화하여 접선-법선 방향으로 ±amp 번갈아 흔든 지그재그 폴리라인 path를 만든다.
 * 양 끝점의 진폭은 0이다.
 */
export function arcZigzag(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow: number,
  amp = 5,
  seg = 12,
): string {
  const { cx, cy } = arcControl(x1, y1, x2, y2, bow);
  const { len } = axis(x1, y1, x2, y2);
  const n = Math.max(6, Math.round(len / seg));
  const parts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    const Bx = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
    const By = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
    // 접선 B'(t)
    const Tx = 2 * mt * (cx - x1) + 2 * t * (x2 - cx);
    const Ty = 2 * mt * (cy - y1) + 2 * t * (y2 - cy);
    const tl = Math.hypot(Tx, Ty) || 1;
    // 접선의 단위 법선
    const mnx = -Ty / tl;
    const mny = Tx / tl;
    const s = i === 0 || i === n ? 0 : i % 2 ? amp : -amp;
    const px = Bx + mnx * s;
    const py = By + mny * s;
    parts.push(`${i === 0 ? "M" : "L"} ${px} ${py}`);
  }
  return parts.join(" ");
}

/**
 * 노드 회피 곡률을 계산한다.
 * from/to 사이에 낀 노드가 있으면 호가 그 노드를 비껴가도록 곡률을 키운다.
 * from/to는 전달된 객체의 동일성(identity)으로 제외한다.
 * (design doc §9 pitfall #2: 베지어 호 높이가 t=0.5에서 bow/2이므로
 *  보정 계수 2*(1-proj)*proj로 나눠야 한다.)
 */
export function emotionalBow(
  from: GeoNode,
  to: GeoNode,
  allNodes: GeoNode[],
): number {
  const CLEAR = 16;
  const A = from;
  const B = to;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  // 위쪽 법선
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  let bow = arcBow(len);
  for (const m of allNodes) {
    if (m === from || m === to) continue;
    const px = m.x - A.x;
    const py = m.y - A.y;
    const proj = (px * dx + py * dy) / (len * len);
    if (proj <= 0.12 || proj >= 0.88) continue;
    const perpUp = px * nx + py * ny;
    if (perpUp >= m.r) continue;
    const req = perpUp + m.r + CLEAR;
    if (req <= 0) continue;
    const needed = req / (2 * (1 - proj) * proj);
    if (needed > bow) bow = needed;
  }
  return Math.min(bow, 220);
}

/**
 * 끝점을 심볼 중심에서 심볼 가장자리로 이동시켜 선이 심볼 내부로 들어가지 않게 한다.
 * from-중심은 to 방향으로 (from.r+2)만큼, to-중심은 from 방향으로 (to.r+2)만큼 이동한다.
 */
export function edgeEndpoints(
  from: GeoNode,
  to: GeoNode,
): { x1: number; y1: number; x2: number; y2: number } {
  const { ux, uy } = axis(from.x, from.y, to.x, to.y);
  return {
    x1: from.x + ux * (from.r + 2),
    y1: from.y + uy * (from.r + 2),
    x2: to.x - ux * (to.r + 2),
    y2: to.y - uy * (to.r + 2),
  };
}
