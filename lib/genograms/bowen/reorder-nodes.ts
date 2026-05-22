import { BWGenogramData, PersonNode, FamilyUnit, RelationshipLink } from '@/types/bowengenogram.types';
export function reorderDisplayOrders(data:BWGenogramData):BWGenogramData {
  // 깊은 복사로 원본 데이터 보존
  const nodes = JSON.parse(JSON.stringify(data.nodes)) as PersonNode[];
  // 빠른 검색을 위한 Map 생성
  const nodeMap = new Map<string, PersonNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));
  const familyUnits = JSON.parse(JSON.stringify(data.familyUnits || [])) as FamilyUnit[];

  // 세대별(relLevel)로 그룹화
  console.log(`===levelGroups 생성===`);
  const levelGroups: { [key: number]: PersonNode[] } = {};
  nodes.forEach(node => {
    if (!levelGroups[node.relLevel]) levelGroups[node.relLevel] = [];
    levelGroups[node.relLevel].push(node);
  });
  console.log("1. levelGroups : ", levelGroups);
  // 각 세대별 정렬 처리
  Object.keys(levelGroups).forEach(levelStr => {
    const level = Number(levelStr);
    const group = levelGroups[level];
    let sortedGroup: PersonNode[] = [];

    if (level === 0) {
      const filterSiblings = (id: string) => {
        const targetFamilyUnit = familyUnits.find(fu => fu.childGroups?.some(cg => cg.child_ids.includes(id)));
        if (!targetFamilyUnit) return [];
        return group.filter(n => targetFamilyUnit.childGroups?.some(cg => cg.child_ids.includes(n.id) && n.id !== id))
          .sort((a, b) => (a.attributes.birth_order || 0) - (b.attributes.birth_order || 0));
      }
      const insertSpouses = (siblingNodeArray: PersonNode[]) => {
        const insertedNodeArray: PersonNode[] = [];
        siblingNodeArray.forEach(node => {
          const siblingFU = familyUnits.find(fu => fu.parent_ids.includes(node.id));
          if (siblingFU) {
            const partnerID = siblingFU.parent_ids.find(pId => pId !== node.id);
            const partnerNode = partnerID ? nodeMap.get(partnerID):null;
            if (partnerNode) {
              if (node.gender === 'male') {
                insertedNodeArray.push(node, partnerNode);
              } else {
                insertedNodeArray.push(partnerNode, node);
              }
            }
          } else {
            insertedNodeArray.push(node);
          }
        })
        return insertedNodeArray;
      }
      /**
       * [0세대 정정 규칙]
       * 1구역: IP 형제들 (birth_order 오름차순)
       * 2구역: IP 본인 + 현재 배우자 (중앙 결합)
       * 3구역: 배우자 형제들 (birth_order 오름차순)
       */
      let ipCouple: PersonNode[] = [];
      const ipNode = group.find(n => n.attributes.is_ip);
      if (!ipNode) throw new Error("내담자(IP) 노드가 부족합니다.");
      // 1구역: IP의 형제들 (IP 본인 제외)
      const findIPSiblings = filterSiblings(ipNode.id);
      const ipSiblings = insertSpouses(findIPSiblings);
      console.log("Gen 0 : ipNode = ",ipNode);
      console.log("Gen 0 : ipSiblings = ",ipSiblings);

      const spouseNode = group.find(n => n.attributes.is_spouse_of_ip);
      let spouseSiblings: PersonNode[] = [];
      // 2구역: IP 부부체제 (이미 ipCouple에 할당)
      if (!spouseNode) {
        ipCouple = [ipNode];
      } else {
        ipCouple = [ipNode, spouseNode];
        console.log("Gen 0 : spouseNode = ",spouseNode);
        // 3구역: 배우자의 형제들 (배우자 본인 제외)
        const findSpouseSiblings = filterSiblings(spouseNode.id);
        spouseSiblings = insertSpouses(findSpouseSiblings);
        console.log("Gen 0 : spouseSiblings = ",spouseSiblings);
      }
      
      // 최종 세 구역을 순서대로 병합 (좌에서 우로 하나의 선형 흐름 완성)
      sortedGroup = [...ipSiblings, ...ipCouple, ...spouseSiblings];
      console.log("Gen 0 : sortedGroup = ",sortedGroup);
    } else {
      /**
       * 기타 세대 (-2세대 조부모, 1세대 자녀 등)
       * 기본 birth_order 또는 명세된 순서대로 정렬
       */
      sortedGroup = group.sort((a, b) => (a.attributes.birth_order || 0) - (b.attributes.birth_order || 0));
    }

    // 결정된 순서를 기반으로 각 노드에 고유한 display_order (0, 1, 2...) 할당
    sortedGroup.forEach((node, index) => {
      const targetNode = nodes.find(n => n.id === node.id);
      if (targetNode) {
        targetNode.display_order = index;
      }
    });
  });

  return { ...data, nodes };
}
