import { GenogramData, GenogramNode } from "@/types/genogram.types";
import { reorderNodes } from "./reorder-nodes";
interface PositionedGenogramNode {
  nodes: GenogramNode[];
  canvasSize: {
    width: number;
    height: number;
  }
}
export const calculateNodePositions = (data: GenogramData): PositionedGenogramNode => {
  if (!data || !data.nodes || !data.families) {
    console.error("데이터 형식이 올바르지 않습니다.");
    return {
      nodes: data.nodes,
      canvasSize: { width: 1200, height: 800 }
    };
  }

  const proband = data.nodes.find(n => n.isProband);
  if (!proband) {
    console.error("Proband(대상자)가 데이터에 없습니다.");
    return {
      nodes: data.nodes,
      canvasSize: { width: 1200, height: 800 }
    };
  }

  // 1. 왼쪽 사이드 기준 설정
  const leftSide = proband.gender === 'male' ? 'paternal' : 'maternal';

  // 2. 세대별 노드 수 및 0세대 기준 절대값 순서 정렬
  const levelCounts = data.nodes.reduce((acc, node) => {
    acc[node.relLevel] = (acc[node.relLevel] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const sortedLevels = Object.keys(levelCounts)
    .map(Number)
    .sort((a, b) => {
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      if (absA === absB) return a - b; // 예: -1세대가 1세대보다 먼저 오도록 유지
      return absA - absB;
    });
  
  const maxNodesInRelLevel = Math.max(...Object.values(levelCounts));
  const minY = Math.min(...data.nodes.map(n => n.relLevel));

  // 3. 캔버스 전체 넓이 및 중앙점 계산
  const dynamicWidth = maxNodesInRelLevel * 160 + 400;
  const svgWidth = Math.max(1200, dynamicWidth);
  const centerX = svgWidth / 2;

  // 노드 ID별 최종 좌표를 임시 저장할 맵
  const positionMap: Record<string, { x: number; y: number }> = {};

  // 4. [요구사항] 0세대 -> 가까운 세대 순서로 좌표 미리 계산
  sortedLevels.forEach((level) => {
    const y = (level - minY) * 160 + 100;

    // 해당 세대의 노드들을 사이드(paternal, maternal, center 등)별로 그룹화하여 각각 계산
    // 기존의 '같은 세대 & 같은 사이드 필터링' 방식을 완벽히 재현하기 위함입니다.
    const uniqueSidesInLevel = Array.from(
      new Set(data.nodes.filter(n => n.relLevel === level).map(n => n.side))
    );

    uniqueSidesInLevel.forEach((side) => {
      // 4-1. 기존의 filteredNodes 역할 수행 (세대와 사이드가 같은 노드들 추출)
      const filteredNodes = data.nodes.filter(n => n.relLevel === level && n.side === side);

      // 4-2. 앞서 정제한 비즈니스 규칙 재정렬 함수 호출
      const sameRowSideNodes = reorderNodes(filteredNodes, data.families, proband);
      let groupCenterX = centerX;

      if (level > 0) {
        // [수정 포인트] 자녀 세대 배치 로직의 정교화
        const representativeNode = sameRowSideNodes[0]; // 이 그룹의 대표 노드 하나로 위치 기준 설정
        const family = data.families.find(f => f.id === representativeNode.parentsFamilyId);

        if (family) {
          // 1순위: 이혼/별거 상태이며, 특정 양육권자(custodyId)가 지정된 경우
          const isSingleParenting = family.relationshipType === 'divorced';
          const custodyId = representativeNode.metadata?.custodyId;

          if (isSingleParenting && custodyId && positionMap[custodyId]) {
            // 이혼 가정이면 양육 부모(1번 최수연) 바로 아래로!
            groupCenterX = positionMap[custodyId].x;
          } 
          else {
            // 2순위: 정상 결혼 상태라면 부모의 중앙값 계산 (기존 로직 유지)
            const fPos = family.fatherId ? positionMap[family.fatherId] : null;
            const mPos = family.motherId ? positionMap[family.motherId] : null;
            if (fPos && mPos) groupCenterX = (fPos.x + mPos.x) / 2;
            else if (fPos || mPos) groupCenterX = (fPos || mPos)!.x;
          }
        } else {
          // 부모 정보가 없는 경우 기존 구역 로직 유지
          if (side !== 'center' && side === leftSide) groupCenterX = centerX - (svgWidth * 0.3);
          else if (side !== 'center' && side !== leftSide) groupCenterX = centerX + (svgWidth * 0.3);
        }
      } else {
        // [기존 유지] Level 0 및 부모 세대 배치 로직
        if (side !== 'center' && side === leftSide) groupCenterX = centerX - (svgWidth * 0.3);
        else if (side !== 'center' && side !== leftSide) groupCenterX = centerX + (svgWidth * 0.3);
      }

      const spacing = 160;
      sameRowSideNodes.forEach((node, index) => {
        const offset = (index - (sameRowSideNodes.length - 1) / 2) * spacing;
        positionMap[node.id] = { x: groupCenterX + offset, y: y };
      });
    });
  });

  // 5. 원본 노드 배열을 유지하면서 canvasPosition 속성이 주입된 새 배열 반환
  return {
    nodes: data.nodes.map((node) => ({
    ...node,
    canvasPosition: positionMap[node.id] || { x: centerX, y: 100 } // 예외 대비 방어용 기본값
  })),
    canvasSize: { width: svgWidth, height: 800 }
  };
};