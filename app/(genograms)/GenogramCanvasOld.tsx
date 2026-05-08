'use client';

import { calculateNodePositions } from '@/lib/genograms/old/calculator-node';
import { GenogramData } from '@/types/genogram.types';

interface Props {
  data: GenogramData;
}

export default function GenogramCanvasOld({ data }: Props) {
  if (!data || !data.nodes || !data.families) {
    return <div className="p-4 text-red-500">데이터 형식이 올바르지 않습니다.</div>;
  }
  const proband = data.nodes.find(n => n.isProband);
  if (!proband) {
    return <div className="p-4 text-red-500">Proband(대상자)가 데이터에 없습니다.</div>;
  }
  const { nodes: positionedNodes, canvasSize: { width: svgWidth, height: svgHeight } } = calculateNodePositions(data);

  return (
    // [조정] 가로 길이를 1200으로 늘려 전체가 잘 보이게 함
    <svg width={svgWidth} height={svgHeight} className="mx-auto border bg-white shadow-inner">
      {/* 1. 선 그리기 (공유해주신 로직 그대로 유지) */}
      {data.families.map((fam) => {
        const father = positionedNodes.find(n => n.id === fam.fatherId);
        const mother = positionedNodes.find(n => n.id === fam.motherId);
        if (!father && !mother) return null;

        const fPos = father?.canvasPosition;
        const mPos = mother?.canvasPosition;

        let marriageX: number;
        let marriageY: number;
        if (fPos && mPos) {
          marriageX = (fPos.x + mPos.x) / 2;
          marriageY = fPos.y;
        } else {
          const parentPos = fPos || mPos!;
          marriageX = parentPos.x;
          marriageY = parentPos.y;
        }

        const isDivorced = fam.relationshipType === 'divorced';
        const strokeColor = isDivorced ? "#facc15" : "#94a3b8"; 
        const dashArray = isDivorced ? "5,5" : "0"; 
        const isOnlyChild = fam.childrenIds.length === 1;

        return (
          <g key={fam.id}>
            {/* 결혼선 가로 */}
            {fPos && mPos && (
              <line 
                x1={fPos.x} 
                y1={marriageY} 
                x2={mPos.x} 
                y2={marriageY} 
                stroke={strokeColor} 
                strokeWidth="2" 
                strokeDasharray={dashArray}
              />
            )}
            {/* 수직선 */}
            {fam.childrenIds.some(childId => {
              const child = positionedNodes.find(n => n.id === childId);
              if (!child) return false;
              
              const isRaisedByCurrent = child.metadata?.isRaisedByCurrent === true;
              const custodyId = child.metadata?.custodyId;
              let childStartX = marriageX; // 기본 시작점
              
              // 아래 path에서 사용하는 startX 계산 로직과 동일해야 함
              if (isRaisedByCurrent) {
                const currentFam = data.families.find(f => f.relationshipType === 'married');
                const f = positionedNodes.find(n => n.id === currentFam?.fatherId);
                const m = positionedNodes.find(n => n.id === currentFam?.motherId);
                if (f?.canvasPosition && m?.canvasPosition) {
                  childStartX = (f.canvasPosition.x + m.canvasPosition.x) / 2;
                }
              } else if (custodyId) {
                const careTaker = positionedNodes.find(n => n.id === custodyId);
                if (careTaker?.canvasPosition) childStartX = careTaker.canvasPosition.x;
              }

              // 현재 가족의 중앙점(marriageX)이 이 자녀의 시작점(childStartX)과 일치할 때만 true
              return childStartX === marriageX;
            }) && (
              <line 
                x1={marriageX} y1={marriageY} x2={marriageX} y2={marriageY + 50} 
                stroke={strokeColor} strokeWidth="2" strokeDasharray={dashArray}
              />
            )}
            
            {/* 자녀 연결선 */}
            {fam.childrenIds.map(childId => {
              const child = positionedNodes.find(n => n.id === childId);
              if (!child) return null;
              if (!child.canvasPosition) return null;
              const cPos = child.canvasPosition;
              const isRaisedByCurrent = child.metadata?.isRaisedByCurrent === true; // 현재 부부가 양육 중인지 여부
              const custodyId = child.metadata?.custodyId;
              const careTaker = positionedNodes.find(n => n.id === custodyId);

              // 양육자가 조부모 세대인지 확인 (세대를 건너뛰었는가?)
              // 자녀의 relLevel보다 2단계 이상 위(음수 방향)에 있다면 조부모 세대입니다.
              const isIntergenerational = careTaker && careTaker.relLevel < child.relLevel - 1;

              let startX = marriageX;
              if (isRaisedByCurrent) {
                if (isIntergenerational) {
                  startX = marriageX;
                } else {
                  // 현재 부부가 양육하면, 현재 부부(F2)의 marriageX에서 선을 내림
                  const currentFam = data.families.find(f => f.relationshipType === 'married');
                  const f = positionedNodes.find(n => n.id === currentFam?.fatherId);
                  const m = positionedNodes.find(n => n.id === currentFam?.motherId);
                  if (f?.canvasPosition && m?.canvasPosition) {
                    startX = (f.canvasPosition.x + m.canvasPosition.x) / 2;
                  } else return null;
                }
              } else if (custodyId) {
                // 특정 부모가 양육하면 그 부모의 X좌표에서 직접 수직선을 내림
                const careTaker = positionedNodes.find(n => n.id === custodyId);
                if (careTaker?.canvasPosition) {
                  startX = careTaker.canvasPosition.x;
                } else return null;
              }
              const finalStroke = isRaisedByCurrent ? "#94a3b8" : strokeColor; // 양육 중이면 실선 회색
              const finalDash = isRaisedByCurrent ? "0" : dashArray; // 양육 중이면 실선
              
              return (
                <path
                  key={childId}
                  d={`M ${startX} ${marriageY + 50} L ${cPos.x} ${marriageY + 50} L ${cPos.x} ${cPos.y - 20}`}
                  fill="none"
                  stroke={finalStroke}
                  strokeWidth="2"
                  strokeDasharray={finalDash}
                />
              );
            })}
          </g>
        );
      })}

      {/* 2. 노드 그리기 (공유해주신 로직 유지) */}
      {positionedNodes.map((node) => {
        if (!node.canvasPosition) return null;
        const { x, y } = node.canvasPosition;
        
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