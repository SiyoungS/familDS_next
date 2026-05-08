'use client';

import { reorderDisplayOrders } from '@/lib/genograms/bowen/reorder-nodes';
import { BWGenogramData, PersonNode, RelationshipLink } from '@/types/bowengenogram.types';
import React, { useMemo } from 'react';

interface Props { data: BWGenogramData; }

export default function GenogramCanvas({ data }: Props) {
  data = reorderDisplayOrders(data);
  const NODE_SIZE = 50;
  const LEVEL_Y = 180;
  const SIBLING_X = 150;

  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    data.nodes.forEach((node) => {
      pos[node.id] = {
        x: node.layoutPosition.x,
        y: node.layoutPosition.y,
      };
    });
    return pos;
  }, [data]);

  const renderRelationships = () => {
  const elements: React.JSX.Element[] = [];
  const marriageLineDepth = 60; // 기본 "ㄷ"자 깊이
  
  data.familyUnits.forEach((unit, idx) => {
    const parents = unit.parent_ids.map(id => ({ id, pos: nodePositions[id], node: data.nodes.find(n => n.id === id) }));
    const children = unit.children_ids.map(id => ({ id, pos: nodePositions[id] }));

    // 1. 부모 좌표 확인 (최소 한 명 이상)
    if (parents.length === 0 || !parents[0].pos) return;

    let coupleMidX: number;
    let coupleBottomY: number;

    if (parents.length >= 2 && parents[1].pos) {
      // --- 부부 관계 ("ㄷ"자 선) ---
      const p1 = parents[0].pos;
      const p2 = parents[1].pos;
      
      const leftX = Math.min(p1.x, p2.x);
      const rightX = Math.max(p1.x, p2.x);
      coupleMidX = leftX + (rightX - leftX) / 2;

      // 부모 사이에 다른 노드가 있는지 확인하여 선 깊이 조절
      const hasInterruption = data.nodes.some(n => 
        n.relLevel === parents[0].node?.relLevel && 
        n.layoutPosition.x > leftX && n.layoutPosition.x < rightX &&
        !unit.parent_ids.includes(n.id)
      );
      
      const currentDepth = hasInterruption ? marriageLineDepth + 180 : marriageLineDepth;
      coupleBottomY = p1.y + currentDepth;

      // 부부 "ㄷ"자 그리기
      elements.push(
        <path
          key={`marriage-${idx}`}
          d={`M ${p1.x} ${p1.y + 25} V ${coupleBottomY} H ${p2.x} V ${p2.y + 25}`}
          fill="none"
          stroke="#333"
          strokeWidth="2"
        />
      );

      // 결혼 상태 표시 (예: m. 2023)
      if (unit.legal_status === 'married') {
        if (unit.marriage_year) {
          elements.push(
            <text key={`m-text-${idx}`} x={coupleMidX} y={coupleBottomY - 5} textAnchor="middle" fontSize="12">
              {`m. ${unit.marriage_year}` || ''}
            </text>
          );
        }
      }
    } else {
      // 편부모인 경우
      coupleMidX = parents[0].pos.x;
      coupleBottomY = parents[0].pos.y + 25;
    }

    // 2. 자녀선 처리 (부부 중앙선에서 분기)
    if (children.length > 0) {
      const firstChildX = children[0].pos.x;
      const lastChildX = children[children.length - 1].pos.x;
      const childBranchY = coupleBottomY + 50; // 자녀선이 가로로 퍼지는 높이

      // 부부 중앙에서 자녀 분기점까지 내려오는 수직선
      elements.push(
        <line
          key={`stem-${idx}`}
          x1={coupleMidX} y1={coupleBottomY}
          x2={coupleMidX} y2={childBranchY}
          stroke="#333" strokeWidth="2"
        />
      );

      // 자녀들을 잇는 가로선 ("ㄷ"자 뒤집은 모양의 상단)
      elements.push(
        <line
          key={`branch-h-${idx}`}
          x1={firstChildX} y1={childBranchY}
          x2={lastChildX} y2={childBranchY}
          stroke="#333" strokeWidth="2"
        />
      );

      // 가로선에서 각 자녀에게 내려가는 수직선들
      children.forEach((child, cIdx) => {
        if (!child.pos) return;
        elements.push(
          <line
            key={`child-v-${idx}-${cIdx}`}
            x1={child.pos.x} y1={childBranchY}
            x2={child.pos.x} y2={child.pos.y - 25}
            stroke="#333" strokeWidth="2"
          />
        );
      });
    }
  });

  return elements;
};

  return (
    <div className="w-full h-full flex justify-center bg-white p-10 overflow-auto border rounded-xl">
      <svg width={data.canvasSize.width} height={data.canvasSize.height} 
      // viewBox={`0 0 ${data.canvasSize.width} ${data.canvasSize.height}`}
      >
        <g transform="translate(100, 50)">
          {renderRelationships()}
          {data.nodes.map((node) => {
            const { x, y } = node.layoutPosition;
            const isIP = node.attributes.is_ip;

            const nameLength = node.name.length;
            const estimatedWidth = Math.max(80, nameLength * 12); // 글자당 약 12px 계산

            return (
              <g key={node.id} transform={`translate(${x}, ${y})`}>
                {
                  node.type === 'fetus' ? (
                    <polygon points="0,-20 20,20 -20,20" fill="white" stroke="#475569" strokeWidth="2" />
                  ) 
                  : node.gender === 'male' ? (
                    <rect x={-25} y={-25} width={50} height={50} fill="white" stroke={isIP ? "#2563eb" : "#475569"} strokeWidth={isIP ? 3 : 1.5} />
                  )
                  : node.gender === 'female' ? (
                    <circle r={25} fill="white" stroke={isIP ? "#2563eb" : "#475569"} strokeWidth={isIP ? 3 : 1.5} />
                  ) : (
                    <polygon points="50,10 90,50 50,90 10,50" fill="white" stroke="black" stroke-width="2"/>
                  )
                }
                <foreignObject 
                  x={-(estimatedWidth / 2)} 
                  y={30} 
                  width={estimatedWidth} height={60} >
                  <div className="w-full text-[11px] text-center font-semibold leading-tight break-keep text-black">
                    <span className='border bg-white px-2 py-0.5 block truncate'>{node.name}</span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
