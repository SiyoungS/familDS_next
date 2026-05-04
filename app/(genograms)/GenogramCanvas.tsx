'use client';

import { GenogramData, GenogramNode } from '@/types/genogram.types';

interface Props {
  data: GenogramData;
}

export default function GenogramCanvas({ data }: Props) {
  if (!data || !data.nodes || !data.families) {
    return <div className="p-4 text-red-500">데이터 형식이 올바르지 않습니다.</div>;
  }
  const proband = data.nodes.find(n => n.isProband);
  if (!proband) {
    return <div className="p-4 text-red-500">Proband(대상자)가 데이터에 없습니다.</div>;
  }
  const leftSide = proband.gender === 'male' ? 'paternal' : 'maternal';

  // 각 층(relLevel)마다 노드 수 계산 (디버깅 및 위치 조정에 활용)
  const levelCounts = data.nodes.reduce((acc, node) => {
    acc[node.relLevel] = (acc[node.relLevel] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const maxNodesInRelLevel = Math.max(...Object.values(levelCounts));
  console.log('Nodes per relLevel:', levelCounts);

  const dynamicWidth = maxNodesInRelLevel * 160 + 400;
  const svgWidth = Math.max(1200, dynamicWidth); // 최소 1200, 필요시 확장
  const centerX = svgWidth / 2;

  const reorderNodes = (nodes: GenogramNode[]) => {
    const proband = data.nodes.find(n => n.isProband);
    if (!proband || nodes.length === 0) return nodes;

    return [...nodes].sort((a, b) => {
      const getWeight = (node: GenogramNode) => {
        const nodeIdNum = parseInt(node.id.replace(/[^0-9]/g, '')) || 0;
        // --- 1. 대상자 세대 (Level 0) ---
        if (node.relLevel === 0) {
          // 1. 대상자 (Proband) 고정 기준점
          if (node.isProband) return 100;

          // --- 배우자 관계 로직 시작 ---
          const famWithProband = data.families.find(f => 
            (f.fatherId === proband.id || f.motherId === proband.id) && 
            (f.fatherId === node.id || f.motherId === node.id)
          );

          if (famWithProband) {
            // 2. 가장 최근 또는 현재 배우자 (married)
            if (famWithProband.relationshipType === 'married') return 120;
            
            // 3. 대상자의 전 배우자 (divorced 등)
            // 오래된 순서대로 왼쪽(50~99)에 배치하기 위해 가족 번호를 차감/가산
            const famNum = parseInt(famWithProband.id.replace(/[^0-9]/g, '')) || 0;
            return 50 + famNum; 
          }

          // 4 & 5. 대상자의 현재 배우자가 재혼인 경우, 그 배우자의 전 파트너 처리
          // 현재 배우자(120)의 전 배우자는 그보다 우측(130~140)으로 배치
          const currentSpouseFam = data.families.find(f => 
            (f.fatherId === proband.id || f.motherId === proband.id) && f.relationshipType === 'married'
          );
          const currentSpouseId = currentSpouseFam?.fatherId === proband.id ? currentSpouseFam?.motherId : currentSpouseFam?.fatherId;
          
          if (currentSpouseId) {
            const famWithCurrentSpouse = data.families.find(f => 
              (f.fatherId === currentSpouseId || f.motherId === currentSpouseId) && 
              (f.fatherId === node.id || f.motherId === node.id) &&
              f.id !== currentSpouseFam?.id // 현재 대상자와의 결혼은 제외
            );
            if (famWithCurrentSpouse) {
              const famNum = parseInt(famWithCurrentSpouse.id.replace(/[^0-9]/g, '')) || 0;
              return 130 + famNum; 
            }
          }

          // 6. 형제 및 형제의 배우자 처리
          // 형제들의 부모 가족(F2 등)을 공유하는 인물들
          const probandParentsFam = data.families.find(f => f.childrenIds.includes(proband.id));
          const isSibling = probandParentsFam?.childrenIds.includes(node.id);

          if (isSibling) {
            // 형제는 ID 순서대로 구역(150~)에 배치
            return 150 + nodeIdNum;
          }

          // 형제의 배우자 (해당 형제의 ID 바로 옆에 붙임)
          const famAsInLaw = data.families.find(f => 
            (f.fatherId === node.id || f.motherId === node.id) &&
            probandParentsFam?.childrenIds.some(sibId => f.fatherId === sibId || f.motherId === sibId)
          );
          
          if (famAsInLaw) {
            const siblingId = famAsInLaw.fatherId === node.id ? famAsInLaw.motherId : famAsInLaw.fatherId;
            const siblingIdNum = parseInt(siblingId?.replace(/[^0-9]/g, '') || '0');
            // 형제의 ID값에 0.5를 더해 바로 오른쪽(150 + ID + 0.5)에 배치
            return 150 + siblingIdNum + 0.5;
          }

          return 500 + nodeIdNum; // 기타 인물
        }

        // --- 2. 부모 세대 (Level < 0) ---
        if (node.relLevel < 0) {
          // 대상자의 직계 부모 가족 찾기
          const probandParentsFam = data.families.find(f => f.childrenIds.includes(proband.id));
          if (probandParentsFam) {
            if (node.id === probandParentsFam.fatherId) return 100; // 아버지를 중앙 왼쪽
            if (node.id === probandParentsFam.motherId) return 101; // 어머니를 중앙 오른쪽
          }
          
          // 부모의 다른 배우자나 형제들
          return node.gender === 'male' ? 50 : 150;
        }

        // --- 3. 자녀 세대 (Level > 0) ---
        if (node.relLevel > 0) {
          // 부모의 가족 ID를 기준으로 그룹화하여 정렬
          const parentFamId = node.parentsFamilyId || 'orphan';
          const famNum = parseInt(parentFamId.replace(/[^0-9]/g, '')) || 0;
          
          // 대상자의 자녀인 경우(F2)를 중앙 근처로
          if (parentFamId === proband.ownFamilyIds?.[0]) return 100 + famNum;
          
          return 200 + famNum;
        }

        return 500;
      };

      return getWeight(a) - getWeight(b);
    });
  };

  const getPosition = (node: GenogramNode) => {
    const minY = Math.min(...data.nodes.map(n => n.relLevel));
    const y = (node.relLevel - minY) * 160 + 100;

    // 1. 같은 세대 & 사이드 필터링
    const filteredNodes = data.nodes.filter(n => n.relLevel === node.relLevel && n.side === node.side);

    // 2. [재정렬 함수 호출] 정렬 로직을 여기서 별도로 수행
    const sameRowSideNodes = reorderNodes(filteredNodes);
    
    const index = sameRowSideNodes.findIndex(s => s.id === node.id);
    const spacing = 160; 
    const offset = (index - (sameRowSideNodes.length - 1) / 2) * spacing;

    let baseX = centerX;
    if (node.side !== 'center' && node.side === leftSide) baseX = centerX - (svgWidth * 0.3);
    if (node.side !== 'center' && node.side !== leftSide) baseX = centerX + (svgWidth * 0.3);

    return { x: baseX + offset, y };
  };

  return (
    // [조정] 가로 길이를 1200으로 늘려 전체가 잘 보이게 함
    <svg width={svgWidth} height="800" className="mx-auto border bg-white shadow-inner">
      {/* 1. 선 그리기 (공유해주신 로직 그대로 유지) */}
      {data.families.map((fam) => {
        const father = data.nodes.find(n => n.id === fam.fatherId);
        const mother = data.nodes.find(n => n.id === fam.motherId);
        if (!father || !mother) return null;

        const fPos = getPosition(father);
        const mPos = getPosition(mother);

        const marriageY = fPos.y;
        const centerX = (fPos.x + mPos.x) / 2;

        const isDivorced = fam.relationshipType === 'divorced';
        const strokeColor = isDivorced ? "#facc15" : "#94a3b8"; 
        const dashArray = isDivorced ? "5,5" : "0"; 

        return (
          <g key={fam.id}>
            <line 
              x1={fPos.x} 
              y1={marriageY} 
              x2={mPos.x} 
              y2={marriageY} 
              stroke={strokeColor} 
              strokeWidth="2" 
              strokeDasharray={dashArray}
            />
            <line 
              x1={centerX} 
              y1={marriageY} 
              x2={centerX} 
              y2={marriageY + 50} 
              stroke={strokeColor} 
              strokeWidth="2"
              strokeDasharray={dashArray} // 이혼 가정의 자녀선도 일관성 있게 처리 가능
            />

            {fam.childrenIds.map(childId => {
              const child = data.nodes.find(n => n.id === childId);
              if (!child) return null;
              const cPos = getPosition(child);
              return (
                <path
                  key={childId}
                  d={`M ${centerX} ${marriageY + 50} L ${cPos.x} ${marriageY + 50} L ${cPos.x} ${cPos.y - 20}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                />
              );
            })}
          </g>
        );
      })}

      {/* 2. 노드 그리기 (공유해주신 로직 유지) */}
      {data.nodes.map((node) => {
        const { x, y } = getPosition(node);
        
        return (
          <g key={node.id} transform={`translate(${x},${y})`}>
            {node.status === 'fetus' ? (
              <polygon points="0,-20 20,20 -20,20" fill="#f472b6" stroke="#db2777" strokeWidth="2" />
            ) : node.gender === 'male' ? (
              <rect x="-20" y="-20" width="40" height="40" fill="white" stroke={node.isProband ? "#2563eb" : "#475569"} strokeWidth="2" />
            ) : (
              <circle r="20" fill="white" stroke={node.isProband ? "#2563eb" : "#475569"} strokeWidth="2" />
            )}
            <text y="45" textAnchor="middle" className="text-[11px] font-bold fill-gray-800">
              {node.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}