'use client';

import { calculateGenogramLayout } from '@/lib/genograms/bowen/calculator-nodes';
import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';
import { BWGenogramData, PersonNode, ChildGroup } from '@/types/bowengenogram.types';
import React, { useMemo } from 'react';

interface Props { data: BWGenogramData; }

export default function GenogramCanvas({ data: initialData }: Props) {
  // 1. 순서 재정렬 후 물리적인 양수 좌표 및 캔버스 크기 최종 산출
  const processedData = useMemo(() => {
    const ordered = reorderDisplayOrders(initialData);
    return calculateGenogramLayout(ordered);
  }, [initialData]);

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
        
        const hasInterruption = processedData.nodes.some(n => 
          n.relLevel === parents[0].node?.relLevel && 
          n.layoutPosition.x > Math.min(p1.x, p2.x) && n.layoutPosition.x < Math.max(p1.x, p2.x) &&
          !unit.parent_ids.includes(n.id)
        );
        const currentDepth = hasInterruption ? marriageLineDepth + 150 : marriageLineDepth;
        coupleBottomY = unit.lineCenterPosition.y + currentDepth;
        // 부부 "ㄷ"자 수평선 긋기 (노드 하단 마진 25px 확보 후 아래로 꺾임)
        elements.push(
          <path
            key={`marriage-${unit.id}-${idx}`}
            d={`M ${p1.x} ${p1.y + 25} V ${coupleBottomY} H ${p2.x} V ${p2.y + 25}`}
            fill="none"
            stroke="#333"
            strokeWidth="2"
          />
        );

        // 법적 상태에 따른 보완 선 (이혼: 사선 2개, 별거: 사선 1개)
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
        }

        // 결혼/이혼 상태 텍스트 표기
        if (unit.marriage_year) {
          const statusText = unit.legal_status === 'divorced' 
            ? `m. ${unit.marriage_year}, d. ${unit.divorce_year || ''}`
            : `m. ${unit.marriage_year}`;
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

        // 자녀가 2명 이상일 때 가로로 길게 뻗는 수평 바(Bar) 렌더링
        if (childNodesWithPos.length >= 2) {
          const xCoords = childNodesWithPos.map(c => c.pos?.x).filter(x => x !== undefined) as number[];
          
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

        // 각 자녀 노드 머리 위로 수직 하강하는 꺾임선 연결
        // (단, 쌍둥이 그룹인 경우 분기점이 달라지는 특수 규칙 적용)
        let processedTwinIds = new Set<string>();

        (unit.childGroups || []).forEach((group, gIdx) => {
          if (group.type === 'identical_twins' || group.type === 'fraternal_twins') {
            // 쌍둥이 처리: 가로 분기선에서 하나의 점에서 출발해 V자로 갈라짐
            const twinNodes = group.child_ids.map(id => ({ id, pos: nodePositions[id] })).filter(t => t.pos);
            if (twinNodes.length === 2) {
              const twinMidX = (twinNodes[0].pos.x + twinNodes[1].pos.x) / 2;
              
              // 가로 바에서 쌍둥이 공통 출발점까지 내리는 선
              elements.push(
                <line key={`twin-stem-${unit.id}-${gIdx}`} x1={twinMidX} y1={childBranchY} x2={twinMidX} y2={childBranchY + 20} stroke="#333" strokeWidth="2" />
              );
              // 공통점에서 각 쌍둥이 노드 머리 위(-25px)까지 V자로 연결
              elements.push(
                <line key={`twin-v1-${unit.id}-${gIdx}`} x1={twinMidX} y1={childBranchY + 20} x2={twinNodes[0].pos.x} y2={twinNodes[0].pos.y - 25} stroke="#333" strokeWidth="2" />,
                <line key={`twin-v2-${unit.id}-${gIdx}`} x1={twinMidX} y1={childBranchY + 20} x2={twinNodes[1].pos.x} y2={twinNodes[1].pos.y - 25} stroke="#333" strokeWidth="2" />
              );

              // 일란성(identical) 쌍둥이인 경우 두 사선 사이를 연결하는 수평 가로선 추가 (보웬 규칙)
              if (group.type === 'identical_twins') {
                const innerY = childBranchY + 30; // V자 중간 높이 계산
                // 두 자녀 X 좌표의 내분점을 활용한 짧은 링킹 바
                const ratio = 0.4;
                const x1 = twinMidX + (twinNodes[0].pos.x - twinMidX) * ratio;
                const x2 = twinMidX + (twinNodes[1].pos.x - twinMidX) * ratio;
                elements.push(
                  <line key={`twin-identical-bar-${unit.id}-${gIdx}`} x1={x1} y1={innerY} x2={x2} y2={innerY} stroke="#333" strokeWidth="2" />
                );
              }
              group.child_ids.forEach(id => processedTwinIds.add(id));
            }
          }
        });

        // 쌍둥이가 아닌 일반 자녀들의 표준 수직선 매핑
        childNodesWithPos.forEach((child, cIdx) => {
          if (!child.pos || processedTwinIds.has(child.id)) return;
          elements.push(
            <line
              key={`child-v-${unit.id}-${cIdx}`}
              x1={child.pos.x} y1={childBranchY}
              x2={child.pos.x} y2={child.pos.y - 25}
              stroke="#333"
              strokeWidth="2"
            />
          );
        });
      }
    });

    return elements;
  };

  return (
    <div className="w-full h-full flex justify-center bg-white p-4 overflow-auto border rounded-xl">
      <svg 
        width={processedData.canvasSize.width} 
        height={processedData.canvasSize.height}
        viewBox={`0 0 ${processedData.canvasSize.width} ${processedData.canvasSize.height}`}
        className="block"
      >
        {/* 전체 양수 변환이 끝났으므로 과도한 기본 마진 제거, 레이어 컨테이너 구성 */}
        <g transform="translate(0, 0)">
          {renderRelationships()}
          
          {processedData.nodes.map((node) => {
            const { x, y } = node.layoutPosition;
            const isIP = node.attributes.is_ip;
            const nameLength = node.name.length;
            const estimatedWidth = Math.max(90, nameLength * 12);

            return (
              <g key={node.id} transform={`translate(${x}, ${y})`}>
                {/* 1. 성별/타입별 도형 렌더링 기본 축 */}
                {node.type === 'fetus' ? (
                  <polygon points="0,-25 25,20 -25,20" fill="white" stroke="#475569" strokeWidth="2" />
                ) : node.gender === 'male' ? (
                  <rect x={-25} y={-25} width={50} height={50} fill="white" stroke={isIP ? "#2563eb" : "#475569"} strokeWidth={isIP ? 3.5 : 2} />
                ) : node.gender === 'female' ? (
                  <circle r={25} fill="white" stroke={isIP ? "#2563eb" : "#475569"} strokeWidth={isIP ? 3.5 : 2} />
                ) : (
                  // 반려동물 또는 미지(마름모 기호)
                  <polygon points="0,-25 25,0 0,25 -25,0" fill="white" stroke="#475569" strokeWidth={2} />
                )}

                {/* 2. 사망 인물 처리 (기호 정중앙 대각선 X 표시) */}
                {node.attributes.is_deceased && (
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
  );
}
