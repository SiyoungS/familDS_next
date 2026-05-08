import { FamilyUnit, GenogramNode } from "@/types/genogram.types";

export const reorderNodes = (nodes: GenogramNode[], families: FamilyUnit[], proband: GenogramNode | undefined) => {
  if (!proband || nodes.length === 0) return nodes;

  return [...nodes].sort((a, b) => {
    const getWeight = (node: GenogramNode) => {
      const nodeIdNum = parseInt(node.id.replace(/[^0-9]/g, "")) || 0;
      
      // 공통 관계 변수
      const ownFamily = families.find(f => f.fatherId === node.id || f.motherId === node.id);
      const parentFamily = families.find(f => f.childrenIds.includes(node.id));

      // --- 1. 대상자 세대 (Level 0) ---
      if (node.relLevel === 0) {
        if (node.isProband) return 100;

        // 대상자의 배우자 (현/전)
        const famWithProband = families.find(f =>
          (f.fatherId === proband.id || f.motherId === proband.id) &&
          (f.fatherId === node.id || f.motherId === node.id)
        );

        if (famWithProband) {
          if (famWithProband.relationshipType === "married" || famWithProband.relationshipType === "unknown") return 120;
          const famNum = parseInt(famWithProband.id.replace(/[^0-9]/g, "")) || 0;
          return 50 + famNum; // 전 배우자(왼쪽)
        }

        // 대상자의 현재 배우자가 재혼인 경우, 그 배우자의 전 파트너 처리
        const currentSpouseFam = families.find(f =>
          (f.fatherId === proband.id || f.motherId === proband.id) && f.relationshipType === "married"
        );
        const currentSpouseId = currentSpouseFam?.fatherId === proband.id ? currentSpouseFam?.motherId : currentSpouseFam?.fatherId;

        if (currentSpouseId && ownFamily) {
          const isSpouseEx = (ownFamily.fatherId === currentSpouseId || ownFamily.motherId === currentSpouseId) && 
                             ownFamily.id !== currentSpouseFam?.id;
          if (isSpouseEx) {
            const famNum = parseInt(ownFamily.id.replace(/[^0-9]/g, "")) || 0;
            return 130 + famNum; // 배우자의 전 배우자(오른쪽)
          }
        }

        // 형제자매 처리
        const probandParentsFam = families.find(f => f.childrenIds.includes(proband.id));
        if (parentFamily && parentFamily.id === probandParentsFam?.id) {
          return 150 + nodeIdNum;
        }

        // 형제의 배우자 처리
        if (ownFamily) {
          const spouseId = ownFamily.fatherId === node.id ? ownFamily.motherId : ownFamily.fatherId;
          if (probandParentsFam?.childrenIds.includes(spouseId || "")) {
            const sibIdNum = parseInt(spouseId?.replace(/[^0-9]/g, "") || "0");
            return 150 + sibIdNum + 0.5; // 형제 바로 옆
          }
        }
      }

      // --- 2. 부모 세대 (Level < 0) ---
      if (node.relLevel < 0) {
        const probandParentsFam = families.find(f => f.childrenIds.includes(proband.id));
        if (probandParentsFam) {
          if (node.id === probandParentsFam.fatherId) return 100;
          if (node.id === probandParentsFam.motherId) return 101;
        }
        return (node.gender === "male" ? 50 : 150) + nodeIdNum;
      }

      // --- 3. 자녀 세대 (Level > 0) ---
      // [핵심] 여기서 박정민님과 미상 배우자가 겹치지 않게 처리합니다.
      if (node.relLevel > 0) {
        // 본인이 자녀인 경우 (박정민 등)
        if (parentFamily) {
          const isDirectChild = proband.ownFamilyIds?.includes(parentFamily.id);
          const isRaisedByCurrent = node.metadata?.isRaisedByCurrent === true; // 현재 부부가 양육 중인지 여부
          const custodyId = node.metadata?.custodyId; // 양육권자 ID (데이터에 있을 경우)

          // [핵심] 현재 부부가 양육한다면 대상자 부부 그룹(100번대)으로 합류시킴
          if (isRaisedByCurrent) {
            return 100 + (nodeIdNum * 0.01); 
          }

          // 그 외에는 친부모의 가족 번호를 기준으로 배치 (기존 로직 유지)
          const famNum = parseInt(parentFamily.id.replace(/[^0-9]/g, "")) || 0;
          const baseWeight = isDirectChild ? 100 : 200;
          
          // 만약 특정 부모(예: 아빠)가 단독 양육한다면 위치를 미세하게 조정할 수 있음
          const custodyOffset = custodyId ? 0.05 : 0;

          return baseWeight + famNum + (nodeIdNum * 0.01) + custodyOffset;
        }

        // 본인이 자녀의 배우자인 경우 (미상 배우자 등)
        if (ownFamily) {
          const spouseId = ownFamily.fatherId === node.id ? ownFamily.motherId : ownFamily.fatherId;
          const spouseNode = nodes.find(n => n.id === spouseId); // 형제/자녀 노드 찾기
          const spouseParentFam = families.find(f => f.childrenIds.includes(spouseId || ""));
          
          if (spouseParentFam) {
            // 배우자의 정렬 가중치를 먼저 파악
            const isSpouseRaisedByCurrent = spouseNode?.metadata?.isRaisedByCurrent === true;
            const isSpouseOfDirect = proband.ownFamilyIds?.includes(spouseParentFam.id);
            
            const base = (isSpouseRaisedByCurrent || isSpouseOfDirect) ? 100 : 200;
            const famNum = parseInt(spouseParentFam.id.replace(/[^0-9]/g, "")) || 0;
            const spouseIdNum = parseInt(spouseId?.replace(/[^0-9]/g, "") || "0");
            
            // 배우자 바로 옆(+0.5)에 배치
            return base + famNum + (spouseIdNum * 0.01) + 0.5;
          }
        }
      }

      return 500 + nodeIdNum;
    };

    return getWeight(a) - getWeight(b);
  });
};
