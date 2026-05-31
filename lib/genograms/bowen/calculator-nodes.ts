import { BWGenogramData, PersonNode, FamilyUnit, ChildGroup } from '@/types/bowengenogram.types';

interface LayoutConfig {
  nodeWidthGap: number;     // 모든 수평 노드 간격 고정 (기본 150px)
  levelHeightGap: number;   // 세대 간 수직 간격 (기본 250px)
  lineMarginY: number;      // "ㄷ"자 수평선이 지나갈 세대 내 내부 마진 Y축 (기본 50px)
  canvasMargin: number; // 캔버스에 둘 여백
}

export function deepCopyJson<T>(value: T): T {
  if (value === undefined) return value; 
  return JSON.parse(JSON.stringify(value));
}

export function calculateGenogramLayout(
  data: BWGenogramData,
  config: LayoutConfig = { nodeWidthGap: 150, levelHeightGap: 250, lineMarginY: 50, canvasMargin: 100 }
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
  const totalGenerations = maxLevel - minLevel + 1;

  // ==========================================
  // [단계 1] 모든 노드의 세대별 Y축 상대좌표 기본 지정 (세대 간격 기본값 설정)
  // ==========================================
  levels.forEach(level => {
    const group = levelGroups[level];
    let yPos = level * config.levelHeightGap;
    group.forEach(node => {
      node.layoutPosition = { x: 0, y: Math.round(yPos) };
      console.log(`node ${node.id} relLevel ${node.relLevel} initial layoutPosition: `, node.layoutPosition);
    });
  });
  
  familyUnits.forEach((unit) => {
    const parents = nodes.filter(n => unit.parent_ids.includes(n.id));
    if (parents.length === 0) return;
    
    // 부모들의 Y 좌표 
    const parentY = parents[0].layoutPosition.y;
    const maxParentY = Math.max(...parents.map(p => p.layoutPosition.y));

    const parentsGroup = levelGroups[parents[0].relLevel].sort((a, b) => a.display_order - b.display_order);
    // 같은 세대 내 부모 사이에 낀 노드
    const firstParentIndex = parentsGroup.findIndex(p => p.id === parents[0].id);
    const lastParentIndex = parentsGroup.findIndex(p => p.id === parents[1]?.id);
    const minParentIndex = Math.min(firstParentIndex, lastParentIndex);
    const maxParentIndex = Math.max(firstParentIndex, lastParentIndex);
    const betweenParents: PersonNode[] = parentsGroup.map((n,i) => {
      if (i > minParentIndex && i < maxParentIndex) return n;
    }).filter((v): v is NonNullable<typeof v> => !!v);
    console.log("betweenParents: ", betweenParents.map(n => n.id));
    let otherBetweenUnitsCount = 0;
    let betweenUnitMaxY = 0;
    betweenParents.forEach(n => {
      // 자식이 있는 경우에만 카운팅
      const otherBetweenUnit = familyUnits.filter(u => 
        u.parent_ids.includes(n.id) 
        && u.parent_ids.some(id => parents.some(p => p.id === id))
        && u.id !== unit.id
        && u.childGroups.length > 0
      );
      if (otherBetweenUnit.length > 0) {
        const unitMaxY = Math.max(
          ...otherBetweenUnit.flatMap(u => u.childGroups?.flatMap(g => g.child_ids).map(id => nodes.find(n => n.id === id)?.layoutPosition.y).filter((v): v is number => !!v) || [])
        )-160;
        betweenUnitMaxY = Math.max(betweenUnitMaxY, unitMaxY);
        otherBetweenUnitsCount++;
      }
    })
    unit.lineY = betweenUnitMaxY;
    console.log(`FamilyUnit ${unit.id} has ${otherBetweenUnitsCount} other units between parents.`);
    
    const childY = parentY  + ((otherBetweenUnitsCount+1)*config.levelHeightGap);

    unit.childGroups.forEach(group => {
      group.child_ids.forEach(childId => {
        const child = nodes.find(n => n.id === childId);
        if (child && child.relLevel > 0) {
          child.layoutPosition.y = childY;
        }
      });
    });
  });

  // ==========================================
  // [단계 2] 최우선 순위: 가장 노드가 많은 '기준 세대' 일렬 완벽 고정 배치
  // ==========================================
  const pivotGroup = levelGroups[pivotLevel].sort((a, b) => a.display_order - b.display_order);
  const pivotTotalWidth = (pivotGroup.length - 1) * config.nodeWidthGap;
  const pivotStartX = -pivotTotalWidth / 2;

  pivotGroup.forEach((node, index) => {
    node.layoutPosition.x = Math.round(pivotStartX + (index * config.nodeWidthGap));
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
      if (parents.length !== 2) return;
      
      const p1 = parents[0].layoutPosition;
      const p2 = parents[1].layoutPosition;
      const coupleCenterX = (p1.x + p2.x) / 2;

      const allChildIds = (unit.childGroups || []).reduce((acc: string[], g: ChildGroup) => {
        return [...acc, ...(g.child_ids || [])];
      }, []);
      const currentLevelChildren = nodes.filter(n => n.relLevel === l && allChildIds.includes(n.id));
      
      if (currentLevelChildren.length === 0) return;
      
      currentLevelChildren.sort((a, b) => a.display_order - b.display_order);
      
      if (currentLevelChildren.length === 1) {
        currentLevelChildren[0].layoutPosition.x = Math.round(coupleCenterX);
        const childMarried = familyUnits.find(fu => fu.parent_ids.includes(currentLevelChildren[0].id));
        if (childMarried) {
          const partnerID = childMarried.parent_ids.find(pId => pId !== currentLevelChildren[0].id);
          const partnerNode = partnerID ? nodes.find(n => !n.attributes.is_ip && n.id === partnerID) : null;
          if ( partnerNode) {
            partnerNode.layoutPosition.x = Math.round(coupleCenterX + config.nodeWidthGap);
          }
        }
      } else {
        const childTotalWidth = (currentLevelChildren.length - 1) * config.nodeWidthGap;
        const childStartX = coupleCenterX - childTotalWidth / 2;
        currentLevelChildren.forEach((childNode, index) => {
          childNode.layoutPosition.x = Math.round(childStartX + (index * config.nodeWidthGap));
        });
      }
    });
  }

  // 3-2. 상향 전파 (부모 세대 조정): 자녀들의 X 기준 중앙 정렬
  for (let l = pivotLevel - 1; l >= minLevel; l--) {
    if (!levelGroups[l]) continue;

    // 이 세대의 부모 노드들을 포함하는 유닛 탐색
    familyUnits.forEach(unit => {
      const parents = nodes.filter(n => n.relLevel === l && unit.parent_ids.includes(n.id));
      if (parents.length !== 2) return; // 부모 둘 다 현재 세대인 경우만 처리

      const allChildIds = unit.childGroups.reduce((acc: string[], g: ChildGroup) => [...acc, ...g.child_ids], []);
      const childrenNodes = nodes.filter(n => nobleGroupChild(n, allChildIds));
      
      function nobleGroupChild(n: PersonNode, ids: string[]) {
        return ids.includes(n.id) && n.layoutPosition.x !== 0; // 이미 좌표가 잡힌 자녀 기준
      }

      if (childrenNodes.length === 0) return;

      // 자녀들의 평균(중앙) X 위치 구하기
      const childrenXValues = childrenNodes.map(n => n.layoutPosition.x);
      const childrenCenterX = (Math.min(...childrenXValues) + Math.max(...childrenXValues)) / 2;

      // 부모 쌍(남, 여 순서)을 자녀 중심점 기준으로 정렬 고정
      parents.sort((a, b) => a.display_order - b.display_order);
      parents[0].layoutPosition.x = Math.round(childrenCenterX - (config.nodeWidthGap / 2));
      parents[1].layoutPosition.x = Math.round(childrenCenterX + (config.nodeWidthGap / 2));
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
  // ==========================================
  familyUnits.forEach(unit => {
    const parents = nodes.filter(n => unit.parent_ids.includes(n.id));
    if (parents.length === 2) {
      const p1 = parents[0].layoutPosition;
      const p2 = parents[1].layoutPosition;
      const lineY = unit.lineY ? unit.lineY : 0;
      unit.lineCenterPosition = {
        x: Math.round((p1.x + p2.x) / 2),
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

  const dynamicWidth = (maxX - minX) + (config.canvasMargin * 2) + (config.nodeWidthGap * 2);
  const dynamicHeight = (maxY - minY) + (config.canvasMargin * 2) + (config.levelHeightGap * 2);
  
  const shiftX = config.canvasMargin - minX;
  const shiftY = config.canvasMargin - minY;

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
