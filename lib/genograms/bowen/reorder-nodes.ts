import { BWGenogramData, PersonNode, FamilyUnit, RelationshipLink } from '@/types/bowengenogram.types';
export function reorderDisplayOrders(data:BWGenogramData):BWGenogramData {
  console.log("===Reordering display_orders for Genogram Nodes===");
  console.log("data: ", JSON.stringify(data));
  // 깊은 복사로 원본 데이터 보존
  const nodes = JSON.parse(JSON.stringify(data.nodes)) as PersonNode[];
  // 빠른 검색을 위한 Map 생성
  const nodeMap = new Map<string, PersonNode>();
  nodes.forEach(node => {
    node.display_order = -1;
    nodeMap.set(node.id, node);
  });
  const familyUnits = JSON.parse(JSON.stringify(data.familyUnits || [])) as FamilyUnit[];

  // 세대별(relLevel)로 그룹화
  console.log(`===levelGroups 생성===`);
  const levelGroups: { [key: number]: PersonNode[] } = {};
  nodes.forEach(node => {
    if (!levelGroups[node.relLevel]) levelGroups[node.relLevel] = [];
    levelGroups[node.relLevel].push(node);
  });
  console.log("1. levelGroups : ", levelGroups);

  // 0세대 전용 배우자 삽입 함수
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
  // 기타 세대 배우자 삽입 함수
  const insertPartners = (node: PersonNode) => {
    const insertedNodeArray: PersonNode[] = [];
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
    return insertedNodeArray;
  }
  const reorderPartners = (partnerGroupNode: PersonNode[]) => {
    if (partnerGroupNode.length !== 2) return partnerGroupNode;
    const [nodeA, nodeB] = partnerGroupNode;
    if (nodeA.gender === 'male') {
      return [nodeA, nodeB];
    } else {
      return [nodeB, nodeA];
    }
  }
  console.log("===Start reordering display_orders by relLevel===");
  // 각 세대별 정렬 처리
  Object.keys(levelGroups).forEach(levelStr => {
    const level = Number(levelStr);
    const group = levelGroups[level];
    let sortedGroup: PersonNode[] = [];

    if (level === 0) {
      console.log("===Processing Gen 0 (IP generation) with special rules===");
      const filterSiblings = (id: string) => {
        const targetFamilyUnit = familyUnits.find(fu => fu.childGroups?.some(cg => cg.child_ids.includes(id)));
        if (!targetFamilyUnit) return [];
        return group.filter(n => targetFamilyUnit.childGroups?.some(cg => cg.child_ids.includes(n.id) && n.id !== id))
          .sort((a, b) => (a.attributes.birth_order || 0) - (b.attributes.birth_order || 0));
      }
      
      /**
       * [0세대 정정 규칙]
       * 1구역: IP 형제들 (birth_order 오름차순)
       * 2구역: IP 본인 + IP 전 배우자 + 현재 배우자 + 현재 배우자의 전 배우자 (중앙 결합)
       * 3구역: 배우자 형제들 (birth_order 오름차순)
       */
      const ipNode = group.find(n => n.attributes.is_ip);
      if (!ipNode) throw new Error("내담자(IP) 노드가 부족합니다.");
      // 1구역: IP의 형제들 (IP 본인 제외)
      const findIPSiblings = filterSiblings(ipNode.id);
      const ipSiblings = insertSpouses(findIPSiblings);

      // 2구역: IP 관련 부부체제 수집
      const ipRelatedUnits = familyUnits.filter(fu => fu.parent_ids.includes(ipNode.id));
      const ipCoupleSet = new Set<PersonNode>([ipNode]);
      
      ipRelatedUnits.forEach(fu => {
        const partnerID = fu.parent_ids.find(pId => pId !== ipNode.id);
        const partnerNode = partnerID ? nodeMap.get(partnerID) : null;
        if (partnerNode) ipCoupleSet.add(partnerNode);
      });

      const spouseNode = group.find(n => n.attributes.is_spouse_of_ip);
      let spouseSiblings: PersonNode[] = [];
      if (spouseNode) {
        const spouseRelatedUnits = familyUnits.filter(fu => fu.parent_ids.includes(spouseNode.id));
        spouseRelatedUnits.forEach(fu => {
          const partnerID = fu.parent_ids.find(pId => pId !== spouseNode.id);
          const partnerNode = partnerID ? nodeMap.get(partnerID) : null;
          if (partnerNode && partnerNode.id !== ipNode.id) {
            ipCoupleSet.add(partnerNode);
          }
        });

        // 3구역: 배우자의 형제들
        const findSpouseSiblings = filterSiblings(spouseNode.id);
        spouseSiblings = insertSpouses(findSpouseSiblings);
      }
      const ipCouple = Array.from(ipCoupleSet);
      // 최종 세 구역을 순서대로 병합 (좌에서 우로 하나의 선형 흐름 완성)
      sortedGroup = [...ipSiblings, ...ipCouple, ...spouseSiblings];
      console.log("1. Gen 0 : sortedGroup = ",sortedGroup.map(n => n.name));
    } else if (level > 0) {
      /**
       * 아랫 세대
       * 1. 부모가 같은 노드들끼리 그룹핑 (형제자매 그룹)
       * 2. 각 그룹 내에서 birth_order 기준으로 정렬
       * 3. 부모 세대에서 이미 display_order가 결정된 노드들을 기준으로 자녀 세대의 display_order 결정 (부모-자녀 간 시각적 일관성 확보)
       * 4. 자녀 세대의 관계자 노드 추가(배우자/전배우자 등)
       */
      const siblingGroups = new Map<string, PersonNode[]>();
      group.forEach(node => {
        const fu = familyUnits.find(f => f.childGroups?.some(cg => cg.child_ids.includes(node.id)));
        const key = fu ? fu.id : 'no-parent';
        if (!siblingGroups.has(key)) siblingGroups.set(key, []);
        siblingGroups.get(key)!.push(node);
      });
      console.log(`2-1. Gen ${level} siblingGroups = `, Array.from(siblingGroups.entries().map(([k, v]) => [k, v.map(n => n.name)])));
      // 부모 세대 정렬에 따라 자녀 세대의 display_order 결정
      const beforeLevelNodeGroup = nodes.filter(n => n.relLevel === level - 1).sort((a, b) => a.display_order - b.display_order);
      console.log(`2-2. Gen ${level} beforeLevelNodeGroup = `, beforeLevelNodeGroup.map(n => `${n.name} (display_order: ${n.display_order})`));

      beforeLevelNodeGroup.forEach(parentNode => {
        const familyID = familyUnits.find(fu => fu.parent_ids.includes(parentNode.id))?.id;
        if (!familyID) return;
          const siblingGroup = siblingGroups.get(familyID);
          if (!siblingGroup) return;
          const sortedSiblings = siblingGroup.sort((a, b) => (a.attributes.birth_order || 0) - (b.attributes.birth_order || 0));
          console.log(`\nGen ${level} parentNode ${parentNode.name} has siblingGroup = `, sortedSiblings.map(n => `${n.name} (birth_order: ${n.attributes.birth_order})`));
          sortedSiblings.forEach(node => {
            if (sortedGroup.some(n => n.id === node.id)) return; // 이미 추가된 노드는 스킵
            const addedPartners = insertPartners(node); // 배우자 삽입
            console.log(`ADD: Gen ${level} node ${node.name} with partners = `, addedPartners.map(n => n.name));
            sortedGroup.push(...addedPartners);
          });
      })

    } else {
      /**
       * 윗 세대
       * 0세대를 기준으로 부모 세대의 display_order 결정
       */
      const partnerGroups = new Map<string, PersonNode[]>();
      group.forEach(node => {
        const fu = familyUnits.find(f => f.parent_ids?.some(cg => cg.includes(node.id)));
        const key = fu ? fu.id : 'no-parent';
        if (!partnerGroups.has(key)) partnerGroups.set(key, []);
        partnerGroups.get(key)!.push(node);
      });
      // 자식 세대 정렬에 따라 부모 세대의 display_order 결정
      const nextLevelNodeGroup = nodes.filter(n => n.relLevel === level - 1).sort((a, b) => a.display_order - b.display_order);
      
      nextLevelNodeGroup.forEach(childNode => {
        const familyID = familyUnits.find(fu => fu.childGroups?.some(cg => cg.child_ids.includes(childNode.id)))?.id;
        if (!familyID) return;
        const partnerGroup = partnerGroups.get(familyID);
        if (!partnerGroup) return;
        // sortedGroup에 추가된 노드는 리턴
        const reorderedPartners = reorderPartners(partnerGroup);
        sortedGroup.push(...reorderedPartners);
        partnerGroups.delete(familyID); // 이미 처리된 그룹은 삭제하여 중복 방지
      })
      sortedGroup = group.sort((a, b) => (a.attributes.birth_order || 0) - (b.attributes.birth_order || 0));
      
    }
    const displayOrders = sortedGroup.map((n,i) => `${n.id}:${n.name} (display_order: ${i})`);
    console.log(`\nGen ${level} displayOrders length = `, displayOrders.length,`\ndisplayOrders = `, displayOrders);
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
