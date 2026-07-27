import { BWGenogramData, PersonNode, FamilyUnit, ChildGroup } from '@/types/bowengenogram.types';

interface LayoutConfig {
  nodeWidthGap: number;     // 모든 수평 노드 간격 고정 (기본 150px)
  levelHeightGap: number;   // 세대 간 수직 간격 (기본 250px)
  lineMarginY: number;      // "ㄷ"자 수평선이 지나갈 세대 내 내부 마진 Y축 (기본 50px)
  canvasMargin: number;     // 캔버스에 둘 여백
  nodeMinGap: number;       // 겹침 방지 안전망: 같은 세대 노드 최소 간격 (기본 70px)
  betweenUnitOffsetY: number; // 부모 사이에 낀 유닛의 "ㄷ"자 보정 오프셋 (기본 160px)
}

export function deepCopyJson<T>(value: T): T {
  if (value === undefined) return value; 
  return JSON.parse(JSON.stringify(value));
}

export function calculateGenogramLayout(
  data: BWGenogramData,
  config: LayoutConfig = { nodeWidthGap: 150, levelHeightGap: 250, lineMarginY: 50, canvasMargin: 100, nodeMinGap: 70, betweenUnitOffsetY: 160 }
): BWGenogramData {
  // 1. 깊은 복사로 원본 데이터 무결성 보존
  const nodes = deepCopyJson<PersonNode[]>(data.nodes);
  const familyUnits = deepCopyJson<FamilyUnit[]>(data.familyUnits);
  console.log("=== deepCopy nodes, familyUnits");
  // 2. 세대별(relLevel) 노드 그룹화 및 인원수 카운트
  const levelGroups: { [key: number]: PersonNode[] } = {};
  nodes.forEach(node => {
    if (!levelGroups[node.relLevel]) levelGroups[node.relLevel] = [];
    levelGroups[node.relLevel].push(node);
  });
  console.log("세대별 노드 그룹화 완료")
  const levelCounts = nodes.reduce((acc, node) => {
    acc[node.relLevel] = (acc[node.relLevel] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  const maxSizeOfLevel = Math.max(...Object.values(levelCounts));
  console.log(`세대별 노드 수: `, levelCounts);

  // 가장 노드가 많은 세대를 찾음 (0번 인덱스)
  const sortedLevelsBySize = Object.keys(levelCounts)
    .map(Number)
    .sort((a,b) => {
      const isAMax = levelCounts[a] === maxSizeOfLevel;
      const isBMax = levelCounts[b] === maxSizeOfLevel;
      if (isAMax && !isBMax) return -1;
      if (!isAMax && isBMax) return 1;
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      if (absA !== absB) return absA - absB;
      return a - b;
    });

  const pivotLevel = sortedLevelsBySize[0]; // 배치 기준이 될 가장 거대한 세대
  console.log(`maxSizeOfLevel = ${maxSizeOfLevel}, pivotLevel = ${pivotLevel}`);

  const levels = Object.keys(levelGroups).map(Number);
  const minLevel = Math.min(...levels);
  const maxLevel = Math.max(...levels);

  // ==========================================
  // [단계 1] 모든 노드의 세대별 Y축 상대좌표 기본 지정 (세대 간격 기본값 설정)
  // [줄 병합] subRow는 별도 줄로 벌리지 않고, 다음 세대의 subRow=0 줄과 "병합"한다.
  // 즉 rowIndex = relLevel + subRow, y = rowIndex * levelHeightGap (간격은 항상 levelHeightGap로 균일).
  // 예: gen0 sub1(IP 부부)의 rowIndex = 0+1 = 1 = gen1 sub0(조카)의 rowIndex → 같은 y.
  // 음수 레벨(원가족 윗세대)은 항상 subRow=0이므로 기존과 동일하게 유지된다.
  // ==========================================
  const rowY = (level: number, sub: number): number => (level + (sub ?? 0)) * config.levelHeightGap;

  levels.forEach(level => {
    const group = levelGroups[level];
    group.forEach(node => {
      node.layoutPosition = { x: 0, y: Math.round(rowY(level, node.subRow ?? 0)) };
      console.log(`node ${node.id} relLevel ${node.relLevel} initial layoutPosition: `, node.layoutPosition);
    });
  });
  
  familyUnits.forEach((unit) => {
    const parents = nodes.filter(n => unit.parent_ids.includes(n.id));
    if (parents.length === 0) return;

    // 부모들의 Y 좌표
    const parentY = parents[0].layoutPosition.y;

    let otherBetweenUnitsCount = 0;
    let betweenUnitMaxY = 0;

    // [#4] '부모 사이에 낀 노드' 계산은 부모가 정확히 2명일 때만 의미가 있다.
    // 편부모(1명) 단위에서 인덱스 -1로 인한 오작동을 방지한다.
    if (parents.length === 2) {
      const parentsGroup = levelGroups[parents[0].relLevel].sort((a, b) => a.display_order - b.display_order);
      // 같은 세대 내 부모 사이에 낀 노드
      const firstParentIndex = parentsGroup.findIndex(p => p.id === parents[0].id);
      const lastParentIndex = parentsGroup.findIndex(p => p.id === parents[1].id);
      const minParentIndex = Math.min(firstParentIndex, lastParentIndex);
      const maxParentIndex = Math.max(firstParentIndex, lastParentIndex);
      const betweenParents: PersonNode[] = parentsGroup.map((n, i) => {
        if (i > minParentIndex && i < maxParentIndex) return n;
      }).filter((v): v is NonNullable<typeof v> => !!v);
      console.log("betweenParents: ", betweenParents.map(n => n.id));
      betweenParents.forEach(n => {
        // 자식이 있는 경우에만 카운팅
        const otherBetweenUnit = familyUnits.filter(u =>
          u.parent_ids.includes(n.id)
          && u.parent_ids.some(id => parents.some(p => p.id === id))
          && u.id !== unit.id
          && u.childGroups.length > 0
        );
        if (otherBetweenUnit.length > 0) {
          // [#2] y=0인 자녀가 truthy 필터에서 누락되지 않도록 != null 사용
          const otherChildYs = otherBetweenUnit.flatMap(u => u.childGroups?.flatMap(g => g.child_ids).map(id => nodes.find(n => n.id === id)?.layoutPosition.y).filter((v): v is number => v != null) || []);
          // [D-3b] subRow 도입으로 y 스케일이 세대별로 달라지므로, 이 유닛의 parentY를 기준으로
          // 상대화한 깊이(depth)를 써야 "ㄷ"자 보정이 튀지 않는다.
          const unitMaxY = Math.max(...otherChildYs) - parentY - config.betweenUnitOffsetY;
          betweenUnitMaxY = Math.max(betweenUnitMaxY, unitMaxY);
          otherBetweenUnitsCount++;
        }
      });
    }
    unit.lineY = betweenUnitMaxY;
    console.log(`FamilyUnit ${unit.id} has ${otherBetweenUnitsCount} other units between parents.`);

    // [D-3a] 기존 절대 childY(parentY + (otherBetweenUnitsCount+1)*levelHeightGap) 대신,
    // 자녀 각자의 relLevel/subRow를 rowY 누적 테이블로 조회해 y를 재지정한다.
    unit.childGroups.forEach(group => {
      group.child_ids.forEach(childId => {
        const child = nodes.find(n => n.id === childId);
        if (child && child.relLevel > 0) {
          child.layoutPosition.y = Math.round(rowY(child.relLevel + otherBetweenUnitsCount, child.subRow ?? 0));
        }
      });
    });
  });

  // [#1] X좌표가 실제로 배치된 노드를 추적한다. (x===0을 '미배치'로 오인하지 않기 위함)
  const placedIds = new Set<string>();

  // 어떤 가족 단위든 '자녀'로 등장하는 노드 집합.
  // 이런 노드는 자기 부모 아래에 독립적으로 배치되므로, 배우자라 해도
  // 다른 가족의 자녀 옆으로 끌어와 배치하면 안 된다. (조부-부모 연결 끊김 방지)
  const childNodeIds = new Set<string>(
    familyUnits.flatMap(u => (u.childGroups || []).flatMap(g => g.child_ids))
  );

  // ==========================================
  // [단계 2] 최우선 순위: 가장 노드가 많은 '기준 세대' 일렬 완벽 고정 배치
  // ==========================================
  const pivotGroup = levelGroups[pivotLevel].sort((a, b) => a.display_order - b.display_order);
  const pivotTotalWidth = (pivotGroup.length - 1) * config.nodeWidthGap;
  const pivotStartX = -pivotTotalWidth / 2;

  pivotGroup.forEach((node, index) => {
    node.layoutPosition.x = Math.round(pivotStartX + (index * config.nodeWidthGap));
    placedIds.add(node.id);
  });

  // ==========================================
  // [단계 3] 유연한 전파 배치 (자식/부모 관계성에 따른 위치 동적 수정)
  // ==========================================
  // 기준 세대(pivotLevel)에서 출발하여 위 세대와 아래 세대로 스며들며 좌표를 전파 및 수정합니다.
  
  // 3-1. 하향 전파 (자녀 세대 조정): 부모들의 X 기준 중앙 정렬
  for (let l = pivotLevel + 1; l <= maxLevel; l++) {
    const currentLevelNodeGroup = levelGroups[l];
    if (!currentLevelNodeGroup) continue;

    // 이 세대의 자녀들을 가지는 부모 유닛 탐색
    familyUnits.forEach(unit => {
      const parents = nodes.filter(n => unit.parent_ids.includes(n.id));
      // [D-4] 편부모 일반화: 부모가 0명(둘 다 제거됨)일 때만 스킵한다. 1명이어도 처리한다.
      if (parents.length === 0) return;

      const coupleCenterX = parents.reduce((sum, p) => sum + p.layoutPosition.x, 0) / parents.length;

      const allChildIds = (unit.childGroups || []).reduce((acc: string[], g: ChildGroup) => {
        return [...acc, ...(g.child_ids || [])];
      }, []);
      const currentLevelChildren = nodes.filter(n => n.relLevel === l && allChildIds.includes(n.id));

      if (currentLevelChildren.length === 0) return;

      currentLevelChildren.sort((a, b) => a.display_order - b.display_order);

      // [#3] 각 자녀와 그 배우자를 display_order 순서대로 하나의 시퀀스로 구성한다.
      // (단일/다자녀 구분 없이 동일 로직으로 처리하여, 다자녀 그룹의 기혼 자녀
      //  배우자가 누락되던 문제를 해결한다.)
      const sequence: PersonNode[] = [];
      const seen = new Set<string>();
      const pushOnce = (node: PersonNode) => {
        if (seen.has(node.id)) return;
        seen.add(node.id);
        sequence.push(node);
      };
      currentLevelChildren.forEach(childNode => {
        const childMarried = familyUnits.find(fu => fu.parent_ids.includes(childNode.id));
        const partnerID = childMarried?.parent_ids.find(pId => pId !== childNode.id);
        // 배우자를 짝으로 끼워 넣는 경우: 배우자가 (1) 같은 부모의 자녀가 아니고
        // (2) 다른 가족의 자녀로 독립 배치되지도 않는 '결혼해 들어온' 인물일 때만.
        // (박정호의 배우자 김미영처럼 자기 부모 아래 배치돼야 하는 인물은 제외)
        const partnerNode = partnerID && !allChildIds.includes(partnerID) && !childNodeIds.has(partnerID)
          ? nodes.find(n => n.id === partnerID) || null
          : null;
        if (partnerNode && partnerNode.display_order < childNode.display_order) {
          pushOnce(partnerNode);
          pushOnce(childNode);
        } else {
          pushOnce(childNode);
          if (partnerNode) pushOnce(partnerNode);
        }
      });

      // '혈연 자녀(allChildIds)'의 중심이 부부 중점에 오도록 시퀀스를 배치한다.
      // (끼워 넣은 배우자는 옆에 따라오되, 자녀가 부부 중점에서 밀려나지 않게 함
      //  → 단일 자녀+익명 배우자 체인에서 연결선이 끊기던 문제 해결)
      const provisional = sequence.map((_, i) => i * config.nodeWidthGap);
      const bloodPos = sequence
        .map((n, i) => (allChildIds.includes(n.id) ? provisional[i] : null))
        .filter((v): v is number => v != null);
      const bloodCenter = bloodPos.length > 0
        ? (Math.min(...bloodPos) + Math.max(...bloodPos)) / 2
        : (provisional[0] + provisional[provisional.length - 1]) / 2;
      const shiftX = coupleCenterX - bloodCenter;
      sequence.forEach((node, index) => {
        node.layoutPosition.x = Math.round(provisional[index] + shiftX);
        placedIds.add(node.id);
      });
    });
  }

  // 3-2. 상향 전파 (부모 세대 조정): 자녀들의 X 기준 중앙 정렬
  for (let l = pivotLevel - 1; l >= minLevel; l--) {
    if (!levelGroups[l]) continue;

    // 이 세대의 부모 노드들을 포함하는 유닛 탐색
    familyUnits.forEach(unit => {
      // [D-4] 편부모 일반화: 유닛의 생존 부모 전원이 '현재 세대(l)'에 있을 때만 처리한다.
      // (부모 중 일부만 이 세대에 있는 경우는 데이터 이상으로 보고 스킵)
      const allParents = nodes.filter(n => unit.parent_ids.includes(n.id));
      const parents = allParents.filter(n => n.relLevel === l);
      if (parents.length === 0 || parents.length !== allParents.length) return;

      const allChildIds = unit.childGroups.reduce((acc: string[], g: ChildGroup) => [...acc, ...g.child_ids], []);
      // [#1] x===0을 '미배치'로 오인하지 않도록 placedIds로 배치 여부를 판단한다.
      const childrenNodes = nodes.filter(n => allChildIds.includes(n.id) && placedIds.has(n.id));

      if (childrenNodes.length === 0) return;

      // 자녀들의 평균(중앙) X 위치 구하기
      const childrenXValues = childrenNodes.map(n => n.layoutPosition.x);
      const childrenCenterX = (Math.min(...childrenXValues) + Math.max(...childrenXValues)) / 2;

      // 부모 쌍(남, 여 순서)을 자녀 중심점 기준으로 정렬 고정. 편부모(1명)는 중심에 그대로 배치.
      parents.sort((a, b) => a.display_order - b.display_order);
      if (parents.length === 2) {
        parents[0].layoutPosition.x = Math.round(childrenCenterX - (config.nodeWidthGap / 2));
        parents[1].layoutPosition.x = Math.round(childrenCenterX + (config.nodeWidthGap / 2));
      } else {
        parents[0].layoutPosition.x = Math.round(childrenCenterX);
      }
      parents.forEach(p => placedIds.add(p.id));
    });
  }

  // ==========================================
  // [단계 3-4] 연결혼 부부 인접 보정 (서로 다른 가문의 자녀가 결혼한 경우)
  // 자녀가 없는 부부(childGroups 비어있음)가 각자 부모 아래로 배치되어 서로
  // 떨어진 경우, 형제 수가 적은(또는 IP가 없는) 쪽 가문의 서브트리를 통째로
  // 이동시켜 부부를 인접시킨다. (자녀가 있는 부부는 자녀가 사이를 잇도록 유지)
  // ==========================================
  const ipId = nodes.find(n => n.attributes.is_ip)?.id;
  const childIdsOf = (u: FamilyUnit) => (u.childGroups || []).flatMap(g => g.child_ids);
  const originUnitOf = (n: PersonNode) => familyUnits.find(u => childIdsOf(u).includes(n.id));
  const siblingCountOf = (u?: FamilyUnit) => u ? childIdsOf(u).length : Number.POSITIVE_INFINITY;
  // 연결혼 unit을 건너뛰고 노드의 가족 그래프 서브트리(부모/자식 방향)를 수집
  // [D-5] 제외 유닛을 여러 개 받는 변형(collectSubtreeMulti)을 두고, 기존 단일-제외
  // 시그니처(collectSubtree)는 이를 감싸는 래퍼로 유지한다(3-4/3-5 호출부 불변).
  const collectSubtreeMulti = (startId: string, excludeUnitIds: Set<string>) => {
    const visited = new Set<string>([startId]);
    const queue = [startId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      familyUnits.forEach(u => {
        if (excludeUnitIds.has(u.id)) return;
        const members = [...(u.parent_ids || []), ...childIdsOf(u)];
        if (members.includes(cur)) {
          members.forEach(m => { if (!visited.has(m)) { visited.add(m); queue.push(m); } });
        }
      });
    }
    return visited;
  };
  const collectSubtree = (startId: string, excludeUnitId: string) => collectSubtreeMulti(startId, new Set([excludeUnitId]));

  familyUnits.forEach(unit => {
    // 자녀가 있는 부부는 자녀 중앙정렬이 처리하므로 제외
    if (childIdsOf(unit).length > 0) return;
    const partners = unit.parent_ids.map(id => nodes.find(n => n.id === id)).filter((v): v is PersonNode => !!v);
    if (partners.length !== 2) return;
    const [pa, pb] = partners;
    if (pa.relLevel !== pb.relLevel) return;
    if (Math.abs(pa.layoutPosition.x - pb.layoutPosition.x) <= config.nodeWidthGap + 1) return; // 이미 인접

    const subA = collectSubtree(pa.id, unit.id);
    const subB = collectSubtree(pb.id, unit.id);
    if (subA.has(pb.id) || subB.has(pa.id)) return; // 다중 연결 등 복잡한 경우는 보정하지 않음

    // 이동할 쪽(mover) 결정: IP가 포함된 가문은 고정, 그 외엔 형제 수가 적은 쪽 이동
    let mover: PersonNode, anchor: PersonNode, moverSub: Set<string>;
    const aHasIp = !!ipId && subA.has(ipId);
    const bHasIp = !!ipId && subB.has(ipId);
    if (aHasIp && !bHasIp) { mover = pb; anchor = pa; moverSub = subB; }
    else if (bHasIp && !aHasIp) { mover = pa; anchor = pb; moverSub = subA; }
    else if (siblingCountOf(originUnitOf(pa)) <= siblingCountOf(originUnitOf(pb))) { mover = pa; anchor = pb; moverSub = subA; }
    else { mover = pb; anchor = pa; moverSub = subB; }

    // anchor가 자기 형제군에서 좌/우 어느 끝인지로 이동 방향 결정
    const anchorOrigin = originUnitOf(anchor);
    const anchorSibs = anchorOrigin
      ? nodes.filter(n => childIdsOf(anchorOrigin).includes(n.id) && placedIds.has(n.id))
      : [anchor];
    const anchorMinX = Math.min(...anchorSibs.map(n => n.layoutPosition.x));
    const anchorMaxX = Math.max(...anchorSibs.map(n => n.layoutPosition.x));
    const putLeft = Math.abs(anchor.layoutPosition.x - anchorMinX) <= Math.abs(anchor.layoutPosition.x - anchorMaxX);
    const targetX = putLeft
      ? anchor.layoutPosition.x - config.nodeWidthGap
      : anchor.layoutPosition.x + config.nodeWidthGap;
    const delta = targetX - mover.layoutPosition.x;
    if (delta === 0) return;

    moverSub.forEach(id => {
      const n = nodes.find(x => x.id === id);
      if (n) n.layoutPosition.x = Math.round(n.layoutPosition.x + delta);
    });
    console.log(`[3-4] 연결혼 인접 보정: ${mover.name} 가문을 ${anchor.name} ${putLeft ? '좌측' : '우측'}으로 ${delta} 이동`);
  });

  // ==========================================
  // [단계 3-5] 다중혼(결혼 2회 이상)인 부모의 표준 배치
  // 각 결혼의 자녀를 그 '부부 중점' 아래에 균일 간격으로 두고(자녀는 부부 안쪽
  // = inset), 배우자를 바깥으로 벌려 결혼-자녀 줄기선이 항상 부부 중점에서
  // 일직선으로 내려가도록 한다. (IP를 기준으로 왼쪽/오른쪽 결혼을 나눠 배치)
  // ==========================================
  // [D-5] 제외 유닛을 여러 개 받는 변형(moveSubtreeMulti)을 두고, 기존 단일-제외
  // 시그니처(moveSubtree)는 이를 감싸는 래퍼로 유지한다(3-4/3-5 호출부 불변).
  const moveSubtreeMulti = (rootId: string, excludeUnitIds: Set<string>, dx: number) => {
    if (dx === 0) return;
    collectSubtreeMulti(rootId, excludeUnitIds).forEach(id => {
      const n = nodes.find(x => x.id === id);
      if (n) n.layoutPosition.x = Math.round(n.layoutPosition.x + dx);
    });
  };
  const moveSubtree = (rootId: string, excludeUnitId: string, dx: number) => moveSubtreeMulti(rootId, new Set([excludeUnitId]), dx);
  const GAP = config.nodeWidthGap;

  nodes.forEach(centerNode => {
    const marriages = familyUnits
      .filter(u => u.parent_ids.includes(centerNode.id) && childIdsOf(u).length > 0)
      .map(u => {
        const spouse = nodes.find(n => n.id === u.parent_ids.find(id => id !== centerNode.id));
        const kids = childIdsOf(u)
          .map(id => nodes.find(n => n.id === id))
          .filter((k): k is PersonNode => !!k && placedIds.has(k.id))
          .sort((a, b) => a.display_order - b.display_order);
        return { u, spouse, kids, width: Math.max(0, (kids.length - 1) * GAP) };
      })
      .filter((m): m is { u: FamilyUnit; spouse: PersonNode; kids: PersonNode[]; width: number } =>
        !!m.spouse && m.kids.length > 0);
    if (marriages.length < 2) return; // 다중혼만 대상 (단혼은 기존 배치 유지)

    const cx = centerNode.layoutPosition.x;
    // IP 기준 왼쪽/오른쪽 결혼 (각각 IP에 가까운 것부터)
    const left = marriages.filter(m => m.spouse.layoutPosition.x < cx)
      .sort((a, b) => b.spouse.layoutPosition.x - a.spouse.layoutPosition.x);
    const right = marriages.filter(m => m.spouse.layoutPosition.x >= cx)
      .sort((a, b) => a.spouse.layoutPosition.x - b.spouse.layoutPosition.x);

    // 한 쪽(왼/오른쪽)을 IP에 가까운 결혼부터 최소 간격으로 배치한다.
    // 각 결혼의 부부 간격(coupleGap) = max(자녀를 담는 최소폭, 이전 배우자보다 한 칸 바깥).
    //  - 자녀 n명 최소폭 = n*GAP (자녀폭 (n-1)*GAP + 양쪽 inset GAP/2)
    //  - 안쪽 자녀는 항상 IP에서 GAP/2 떨어져, 반대편 결혼 자녀와 GAP 간격 확보
    const placeSide = (list: typeof marriages, dir: 1 | -1) => {
      let prevGap = 0; // 직전(더 안쪽) 배우자까지의 거리
      list.forEach(m => {
        const ownGap = m.kids.length * GAP;        // 자녀를 inset으로 담는 최소 부부 간격
        const spaceGap = prevGap + GAP;            // 직전 배우자보다 한 칸 바깥
        const coupleGap = Math.max(ownGap, spaceGap);
        const spouseX = cx + dir * coupleGap;
        const mid = cx + dir * (coupleGap / 2);    // 부부 중점 = 자녀 블록 중심
        const startX = mid - m.width / 2;
        m.kids.forEach((k, i) =>
          moveSubtree(k.id, m.u.id, Math.round(startX + i * GAP) - k.layoutPosition.x));
        moveSubtree(m.spouse.id, m.u.id, Math.round(spouseX) - m.spouse.layoutPosition.x);
        prevGap = coupleGap;
      });
    };
    placeSide(left, -1);
    placeSide(right, 1);
    console.log(`[3-5] 다중혼 배치: ${centerNode.name} (좌${left.length}/우${right.length})`);
  });

  // ==========================================
  // [단계 3-6] IP 부부 줄(0세대, subRow가 IP와 같은 노드들) 좌표 고정
  // 3-1의 '자기 부모가 있는 배우자는 자기 부모 아래' 규칙 때문에 display_order가
  // 인접해도 IP-배우자 x가 서로 멀어지는 경우가 실측에서 확인됐다. IP를 앵커로 두고
  // 그 줄의 나머지 멤버를 GAP 간격으로 강제 정렬해 교정한다. (다중혼 배치 다음,
  // 겹침 해소 이전에 실행 — 겹침 해소가 이 결과를 깨지 않고 다듬도록)
  // ==========================================
  {
    const ipRowNode = ipId ? nodes.find(n => n.id === ipId) : undefined;
    if (ipRowNode) {
      const ipSubRow = ipRowNode.subRow ?? 0;
      const row = nodes
        .filter(n => n.relLevel === 0 && (n.subRow ?? 0) === ipSubRow)
        .sort((a, b) => a.display_order - b.display_order);

      if (row.length >= 2) {
        const ipIdx = row.findIndex(n => n.id === ipRowNode.id);
        const rightMembers = row.slice(ipIdx + 1);          // IP 오른쪽, IP에 가까운 순
        const leftMembers = row.slice(0, ipIdx).reverse();  // IP 왼쪽, IP에 가까운 순

        // IP가 '자녀 있는 결혼'을 2개 이상 가지면 [3-5]가 이미 표준 배치를 마친 것이므로 보존한다.
        const ip35 = familyUnits.filter(u => u.parent_ids.includes(ipRowNode.id) && childIdsOf(u).length > 0).length >= 2;

        const rowIds = new Set(row.map(n => n.id));
        // '블록 내부 유닛': row 멤버 2명을 parent로 갖는 모든 FamilyUnit (IP-전처, IP-배우자, 배우자-전남편 등).
        // 이 유닛들을 제외하고 서브트리를 수집해야 상대 배우자를 통해 IP 쪽까지 끌려오지 않는다.
        const blockUnitIds = new Set(
          familyUnits.filter(u => u.parent_ids.length === 2 && u.parent_ids.every(pid => rowIds.has(pid))).map(u => u.id)
        );

        // [3-4]와 동일한 순환/다중 연결 가드: 이동 대상 서브트리에 IP가 포함되면 이동하지 않고 skip한다.
        // (IP 자신은 앵커이므로 항상 이동하지 않음)
        const guardedMove = (rootId: string, dx: number) => {
          if (dx === 0) return;
          const sub = collectSubtreeMulti(rootId, blockUnitIds);
          if (ipId && sub.has(ipId)) return;
          sub.forEach(id => {
            const n = nodes.find(x => x.id === id);
            if (n) n.layoutPosition.x = Math.round(n.layoutPosition.x + dx);
          });
        };

        const walk = (members: PersonNode[], dir: 1 | -1) => {
          let prev = ipRowNode!;
          members.forEach(m => {
            const directUnit = familyUnits.find(u =>
              u.parent_ids.length === 2 && u.parent_ids.includes(ipRowNode!.id) && u.parent_ids.includes(m.id)
            );
            const directUnitHasKids = !!directUnit && childIdsOf(directUnit).length > 0;
            const dx = m.layoutPosition.x - prev.layoutPosition.x;
            // 다중혼(ip35)이고, IP와 m 사이에 직접 결혼 유닛이 있으며 자녀가 있고,
            // 이미 dir 방향으로 GAP 이상 떨어져 있으면 [3-5]의 배치를 그대로 둔다(pinned).
            const pinned = ip35 && directUnitHasKids && Math.sign(dx) === dir && Math.abs(dx) >= GAP;
            if (!pinned) {
              guardedMove(m.id, (prev.layoutPosition.x + dir * GAP) - m.layoutPosition.x);
            }
            prev = m;
          });
        };
        walk(rightMembers, 1);
        walk(leftMembers, -1);

        // 자녀 재중심화: 부모 중 1명 이상이 row에 속하고 자녀가 있는 각 유닛에 대해,
        // 그 유닛의 생존 부모 x 평균(newMid)에 자녀 시퀀스의 blood 중심이 오도록
        // ([3-1]과 동일한 방식) 각 자녀 서브트리를 이동한다.
        familyUnits.forEach(unit => {
          const allChildIds = childIdsOf(unit);
          if (allChildIds.length === 0) return;
          const unitParents = unit.parent_ids.map(id => nodes.find(n => n.id === id)).filter((v): v is PersonNode => !!v);
          if (unitParents.length === 0 || !unitParents.some(p => rowIds.has(p.id))) return;

          const newMid = unitParents.reduce((s, p) => s + p.layoutPosition.x, 0) / unitParents.length;
          const currentLevelChildren = nodes.filter(n => allChildIds.includes(n.id));
          if (currentLevelChildren.length === 0) return;

          const bloodXs = currentLevelChildren.map(n => n.layoutPosition.x);
          const bloodCenter = (Math.min(...bloodXs) + Math.max(...bloodXs)) / 2;
          const recenterShiftX = newMid - bloodCenter;
          if (recenterShiftX === 0) return;

          currentLevelChildren.forEach(child => guardedMove(child.id, recenterShiftX));
        });
      }
    }
  }

  // ==========================================
  // [단계 3-3] [#7] 같은 Y줄 노드 겹침 해소 (휴리스틱 안전망)
  // 전파 배치 후에도 서로 다른 서브트리의 노드가 가로로 겹칠 수 있으므로,
  // 최소 간격(nodeMinGap)을 보장하도록 좌→우로 밀어내고 중심을 보존한다.
  // 단, Y가 다르면 시각적으로 겹치지 않으므로 같은 Y끼리만 간격을 적용한다.
  // [줄 병합] subRow 병합(rowIndex = relLevel + subRow)으로 서로 다른 relLevel의
  // 노드가 같은 Y를 공유할 수 있다(예: gen0 sub1 IP부부 == gen1 sub0 조카).
  // 그러므로 Y 그룹화는 세대(level) 단위가 아니라 전체 노드 기준으로 수행한다.
  // ==========================================
  {
    const byY = new Map<number, PersonNode[]>();
    nodes.forEach(n => {
      const key = n.layoutPosition.y;
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key)!.push(n);
    });

    byY.forEach(rowNodes => {
      if (rowNodes.length < 2) return;

      // 인접한 두 부모(부부)를 'rigid 그룹'으로 묶어 통째로 이동한다.
      // (부부를 개별로 밀면 간격이 찌그러져 자녀선이 어긋남)
      // 단, 배우자가 여럿인 다중혼 부모는 묶지 않는다(개별 처리) → 순서 왜곡 방지.
      const rowIds = new Set(rowNodes.map(n => n.id));
      // 이 행 안에서 각 노드의 '배우자(co-parent)' 수
      const partnerCount = (id: string) =>
        familyUnits.filter(u =>
          u.parent_ids.length === 2 && u.parent_ids.includes(id) &&
          u.parent_ids.some(pid => pid !== id && rowIds.has(pid))
        ).length;
      const sorted = rowNodes.slice().sort((a, b) => a.layoutPosition.x - b.layoutPosition.x);
      const groups: PersonNode[][] = [];
      for (let i = 0; i < sorted.length; ) {
        const n = sorted[i];
        const m = sorted[i + 1];
        const isCouple = !!m &&
          partnerCount(n.id) === 1 && partnerCount(m.id) === 1 &&
          familyUnits.some(u => u.parent_ids.length === 2 && u.parent_ids.includes(n.id) && u.parent_ids.includes(m.id));
        if (isCouple) { groups.push([n, m]); i += 2; }
        else { groups.push([n]); i += 1; }
      }
      if (groups.length < 2) return;

      const groupLeft = (g: PersonNode[]) => Math.min(...g.map(n => n.layoutPosition.x));
      const groupRight = (g: PersonNode[]) => Math.max(...g.map(n => n.layoutPosition.x));
      groups.sort((a, b) => groupLeft(a) - groupLeft(b));

      const allX = rowNodes.map(n => n.layoutPosition.x);
      const beforeMid = (Math.min(...allX) + Math.max(...allX)) / 2;

      // 좌→우로 그룹 간 최소 간격 보장 (그룹은 통째로 이동)
      for (let i = 1; i < groups.length; i++) {
        const need = groupRight(groups[i - 1]) + config.nodeMinGap - groupLeft(groups[i]);
        if (need > 0) groups[i].forEach(n => { n.layoutPosition.x += need; });
      }

      // 무게중심 보존
      const allX2 = rowNodes.map(n => n.layoutPosition.x);
      const afterMid = (Math.min(...allX2) + Math.max(...allX2)) / 2;
      const shift = beforeMid - afterMid;
      if (shift !== 0) {
        rowNodes.forEach(n => { n.layoutPosition.x = Math.round(n.layoutPosition.x + shift); });
      } else {
        rowNodes.forEach(n => { n.layoutPosition.x = Math.round(n.layoutPosition.x); });
      }
    });
  }

  // ==========================================
  // [단계 4] IP 노드가 (0,0)에 오도록 전체 판 평행이동 오프셋 적용
  // ==========================================
  const ipNode = nodes.find(n => n.attributes.is_ip);
  if (!ipNode) throw new Error("내담자(IP) 노드를 찾을 수 없습니다.");
  
  const ipXOffset = ipNode.layoutPosition.x;
  nodes.forEach(node => {
    node.layoutPosition.x -= ipXOffset;
  });

  // ==========================================
  // [단계 5] 가족 단위(FamilyUnit)의 "ㄷ"자 꺾임 중심점 최종 연산
  // 자녀로 내려가는 줄기선(x)은 부부 중점이 아니라 '자녀들의 중심'에 맞춰
  // 일직선으로 내려가도록 한다. (단, 줄기선이 부부 결합선 위에서 출발하도록
  // 두 부모의 x 범위 안으로 클램프한다.)
  // ==========================================
  familyUnits.forEach(unit => {
    const parents = nodes.filter(n => unit.parent_ids.includes(n.id));
    if (parents.length === 2) {
      const p1 = parents[0].layoutPosition;
      const p2 = parents[1].layoutPosition;
      const parentMidX = (p1.x + p2.x) / 2;

      const childXs = (unit.childGroups || [])
        .flatMap(g => g.child_ids)
        .map(id => nodes.find(n => n.id === id)?.layoutPosition.x)
        .filter((v): v is number => v != null);

      // 3회 이상 재혼 부부는 결혼선이 여러 배우자를 가로지르므로 '부부 중점'을 유지.
      // 그 외(단혼·재혼 1회)는 줄기선을 '자녀 중심'에 맞춰 자녀로 일직선으로 내린다.
      const maxMarriages = Math.max(
        1,
        ...unit.parent_ids.map(pid => familyUnits.filter(u => u.parent_ids.includes(pid) && childIdsOf(u).length > 0).length)
      );
      let stemX = (maxMarriages < 3 && childXs.length > 0)
        ? (Math.min(...childXs) + Math.max(...childXs)) / 2
        : parentMidX;
      // 결합선(p1~p2) 범위 안으로 클램프 → 줄기선이 결합선 위에서 출발
      stemX = Math.max(Math.min(p1.x, p2.x), Math.min(Math.max(p1.x, p2.x), stemX));

      const lineY = unit.lineY ? unit.lineY : 0;
      unit.lineCenterPosition = {
        x: Math.round(stemX),
        y: Math.round((p1.y + p2.y) / 2 + config.lineMarginY + lineY)
      };
    }
  });

  // ==========================================
  // [단계 6] 상대좌표 경계면 기반 캔버스 자동 스케일링 계산
  // ==========================================
  const xValues = nodes.map(n => n.layoutPosition.x);
  const yValues = nodes.map(n=>n.layoutPosition.y);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);

  // 정서 오버레이(호)가 최상단 노드 위로 부풀어 잘리지 않도록 가드된 상단 여유공간 확보.
  // 오버레이가 실제로 존재할 때만 headroom을 추가한다(없으면 결과는 기존과 동일).
  const EMO_EXTRA_TOP = 130;
  const overlayNodeIds = new Set(nodes.map(n => n.id));
  const hasEmotionalOverlay = Array.isArray(data.links) && data.links.some(l =>
    l.emotional_status !== 'normal' && l.emotional_status !== 'triangle' &&
    overlayNodeIds.has(l.from) && overlayNodeIds.has(l.to)
  );
  const extraTop = hasEmotionalOverlay ? EMO_EXTRA_TOP : 0;

  const contentWidth = (maxX - minX) + (config.canvasMargin * 2) + (config.nodeWidthGap * 2);
  const contentHeight = (maxY - minY) + (config.canvasMargin * 2) + (config.levelHeightGap * 2) + extraTop;

  // 기본 캔버스는 A4 가로(landscape, 96DPI ≈ 1123×794px) 기준.
  // 내용이 더 크면 그만큼 캔버스를 키우고, 작으면 A4 크기를 유지한 채 가운데 정렬한다.
  const A4_W = 1123;
  const A4_H = 794;
  const dynamicWidth = Math.max(A4_W, contentWidth);
  const dynamicHeight = Math.max(A4_H, contentHeight);

  // A4 여백만큼 남을 때 내용을 가운데로 이동시키는 보정값
  const centerX = (dynamicWidth - contentWidth) / 2;
  const centerY = (dynamicHeight - contentHeight) / 2;

  const shiftX = config.canvasMargin - minX + centerX;
  const shiftY = config.canvasMargin - minY + centerY + extraTop;

  // 노드 좌표 평행 이동
  nodes.forEach(n => {
    n.layoutPosition.x = Math.round(n.layoutPosition.x + shiftX);
    n.layoutPosition.y = Math.round(n.layoutPosition.y + shiftY);
  });

  // 가족 단위의 중심선 좌표 평행 이동
  familyUnits.forEach(u => {
    if (u.lineCenterPosition) {
      u.lineCenterPosition.x = Math.round(u.lineCenterPosition.x + shiftX);
      u.lineCenterPosition.y = Math.round(u.lineCenterPosition.y + shiftY);
    }
  });

  return {
    nodes,
    links: data.links,
    familyUnits,
    households: data.households,
    canvasSize: {
      width: Math.round(dynamicWidth),
      height: Math.round(dynamicHeight)
    }
  };
}
