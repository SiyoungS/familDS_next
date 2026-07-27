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

  // [#6] 출생순서 동률 시 결정적 정렬을 위한 2차 키(최초 등장 순서)
  const originalIndex = new Map<string, number>(nodes.map((n, i) => [n.id, i]));
  const byBirthOrder = (a: PersonNode, b: PersonNode) =>
    ((a.attributes.birth_order || 0) - (b.attributes.birth_order || 0)) ||
    ((originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0));

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
        } else {
          // [C-1] 파트너를 nodeMap에서 못 찾아도(익명 배우자 제거 등) 노드 자신은 드랍하지 않는다.
          insertedNodeArray.push(node);
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
      } else {
        // [C-1] 파트너를 nodeMap에서 못 찾아도(익명 배우자 제거 등) 노드 자신은 드랍하지 않는다.
        insertedNodeArray.push(node);
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
  // C-3(subRow 계산)에서 사용할 0세대 부부 집합/형제 존재 여부. level===0 처리 중 채워진다.
  let coupleIds = new Set<string>();
  let hasGen0Siblings = false;

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
          .sort(byBirthOrder);
      }
      
      /**
       * [0세대 정정 규칙]
       * 1구역: IP보다 손위 형제 (출생순서상 IP 앞) - 좌측
       * 2구역: IP 본인 + IP 전 배우자 + 현재 배우자 + 현재 배우자의 전 배우자 (중앙 결합)
       * 2.5구역: IP보다 손아래 형제 (출생순서상 IP 뒤) - 우측
       * 3구역: 배우자 형제들 (birth_order 오름차순)
       */
      const ipNode = group.find(n => n.attributes.is_ip);
      if (!ipNode) throw new Error("내담자(IP) 노드가 부족합니다.");
      // 특정 인물의 형제자매를 그 인물의 출생순서(원가족 childGroup 순서) 기준으로
      // 손위(앞)/손아래(뒤)로 분리한다.
      const splitSiblingsAround = (personId: string) => {
        const sibs = filterSiblings(personId);
        const originUnit = familyUnits.find(fu => fu.childGroups?.some(cg => cg.child_ids.includes(personId)));
        const orderIds = originUnit ? (originUnit.childGroups || []).flatMap(cg => cg.child_ids) : [];
        const idx = orderIds.indexOf(personId);
        const byOrder = (a: PersonNode, b: PersonNode) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id);
        const older: PersonNode[] = [];
        const younger: PersonNode[] = [];
        sibs.forEach(s => {
          const sIdx = orderIds.indexOf(s.id);
          if (idx >= 0 && sIdx > idx) younger.push(s);
          else older.push(s);
        });
        return { older: older.sort(byOrder), younger: younger.sort(byOrder) };
      };

      // 1구역/2.5구역: IP 형제를 손위(좌)/손아래(우)로 분리
      const ipSplit = splitSiblingsAround(ipNode.id);
      const ipOlderSiblings = insertSpouses(ipSplit.older);
      const ipYoungerSiblings = insertSpouses(ipSplit.younger);

      // 2구역: IP 배우자(들)를 결혼 순서대로 수집
      const ipRelatedUnits = familyUnits.filter(fu => fu.parent_ids.includes(ipNode.id));
      const ipSpouses = ipRelatedUnits
        .map(fu => ({ order: fu.marriage_order || 0, node: nodeMap.get(fu.parent_ids.find(pId => pId !== ipNode.id) || '') }))
        .filter((x): x is { order: number; node: PersonNode } => !!x.node)
        .sort((a, b) => a.order - b.order)
        .map(x => x.node);

      // '현재 배우자' 판정: is_spouse_of_ip 우선, 없으면 IP 결혼 유닛 중 marriage_order 최댓값의 상대(=ipSpouses 마지막)
      const spouseNode = group.find(n => n.attributes.is_spouse_of_ip);
      const currentSpouse: PersonNode | null = spouseNode || (ipSpouses.length > 0 ? ipSpouses[ipSpouses.length - 1] : null);
      // IP 전 배우자들: ipSpouses 중 현재 배우자를 제외한 나머지 (marriage_order 오름차순 유지)
      const ipExSpouses = currentSpouse ? ipSpouses.filter(n => n.id !== currentSpouse.id) : ipSpouses;

      // 현재 배우자의 다른 파트너들(블렌디드) + 배우자 형제군(손위/손아래)
      const extraPartners: PersonNode[] = [];
      let spouseOlderSiblings: PersonNode[] = [];
      let spouseYoungerSiblings: PersonNode[] = [];
      if (currentSpouse) {
        familyUnits.filter(fu => fu.parent_ids.includes(currentSpouse.id)).forEach(fu => {
          const partnerID = fu.parent_ids.find(pId => pId !== currentSpouse.id);
          const partnerNode = partnerID ? nodeMap.get(partnerID) : null;
          if (partnerNode && partnerNode.id !== ipNode.id) extraPartners.push(partnerNode);
        });
        const sp = splitSiblingsAround(currentSpouse.id);
        spouseOlderSiblings = insertSpouses(sp.older);
        spouseYoungerSiblings = insertSpouses(sp.younger);
      }

      /**
       * [0세대 고정 순서] (C-2)
       * IP형제(손위→손아래) → IP 전배우자들 → IP → 현재 배우자 → 배우자의 다른 파트너들 → 배우자 형제(출생순)
       * '현재 배우자'는 가족 유닛 누락 등으로 ipSpouses에 없더라도 IP 오른쪽 자리에 방어적으로 삽입한다.
       */
      const pushedIds = new Set<string>();
      sortedGroup = [];
      const pushUnique = (n: PersonNode) => {
        if (pushedIds.has(n.id)) return;
        pushedIds.add(n.id);
        sortedGroup.push(n);
      };
      [...ipOlderSiblings, ...ipYoungerSiblings, ...ipExSpouses, ipNode].forEach(pushUnique);
      if (currentSpouse) pushUnique(currentSpouse);
      [...extraPartners, ...spouseOlderSiblings, ...spouseYoungerSiblings].forEach(pushUnique);

      // C-3에서 사용할 0세대 부부 집합/형제 존재 여부 기록
      coupleIds = new Set<string>([
        ipNode.id,
        ...ipExSpouses.map(n => n.id),
        ...(currentSpouse ? [currentSpouse.id] : []),
        ...extraPartners.map(n => n.id),
      ]);
      hasGen0Siblings = ipOlderSiblings.length > 0 || ipYoungerSiblings.length > 0 ||
        spouseOlderSiblings.length > 0 || spouseYoungerSiblings.length > 0;

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
        // [#5] 한 부모가 여러 가족 단위(재혼 등)에 속할 수 있으므로 모든 단위를 순회한다.
        const parentUnits = familyUnits.filter(fu => fu.parent_ids.includes(parentNode.id));
        parentUnits.forEach(unit => {
          const siblingGroup = siblingGroups.get(unit.id);
          if (!siblingGroup) return;
          const sortedSiblings = [...siblingGroup].sort(byBirthOrder); // [#6] 안정 정렬
          console.log(`\nGen ${level} parentNode ${parentNode.name} (unit ${unit.id}) has siblingGroup = `, sortedSiblings.map(n => `${n.name} (birth_order: ${n.attributes.birth_order})`));
          sortedSiblings.forEach(node => {
            if (sortedGroup.some(n => n.id === node.id)) return; // 이미 추가된 노드는 스킵
            const addedPartners = insertPartners(node); // 배우자 삽입
            console.log(`ADD: Gen ${level} node ${node.name} with partners = `, addedPartners.map(n => n.name));
            sortedGroup.push(...addedPartners);
          });
        });
      })

    } else {
      /**
       * 윗 세대
       * 0세대를 기준으로 부모 세대의 display_order 결정
       */
      const partnerGroups = new Map<string, PersonNode[]>();
      group.forEach(node => {
        const fu = familyUnits.find(f => f.parent_ids?.includes(node.id));
        if (fu) {
          // 본인이 부모인 가족
          const key = fu.id;
          if (!partnerGroups.has(key)) partnerGroups.set(key, []);
          partnerGroups.get(key)!.push(node);
        } else {
          // 자식이 없는 경우, 자신이 자식으로 속한 원가족(originFamily) 찾기 
          const originFu = familyUnits.find(f => f.childGroups?.some(cg => cg.child_ids.includes(node.id)));
          // 원가족이 있으면 'origin-{id}', 아예 없으면 'single-{id}'로 고유 키 부여
          const key = originFu ? `origin-${originFu.id}` : `single-${node.id}`;
          if (!partnerGroups.has(key)) partnerGroups.set(key, []);
          partnerGroups.get(key)!.push(node);
        }
      });
      // 자식 세대 정렬에 따라 부모 세대의 display_order 결정
      const nextLevelNodeGroup = nodes
        .filter(n => n.relLevel === level + 1)
        .sort((a, b) => a.display_order - b.display_order);
      
      // 1. 자식 세대에 따라 부모 세대 핵심 노드 정렬
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
      
      // 2. 자식 세대에 속하지 않은 부모/친척 노드 처리 (예: 자식이 없는 부모, 원가족이 없는 친척 등)
      const unplacedNodes: PersonNode[] = [];
      partnerGroups.forEach((partnerGroup, key) => {
        const reorderedPartners = reorderPartners(partnerGroup);
        if (key.startsWith('origin-')) {
          // origin은 자식 세대가 있는 부모의 형제들
          const originFamilyId = key.replace('origin-', '');
          const originFamily = familyUnits.find(fu => fu.id === originFamilyId);
          if (originFamily) {
            const siblingIds = originFamily.childGroups?.flatMap(cg => cg.child_ids) || [];
            const anchorIndex = sortedGroup.findIndex(sn => siblingIds.includes(sn.id));
            if (anchorIndex !== -1) {
              const anchorNode = sortedGroup[anchorIndex];
              if (anchorNode.gender === 'male') {
                // 아버지의 형제는 좌측에
                sortedGroup.splice(anchorIndex, 0, ...reorderedPartners);
              } else {
                // 어머니의 형제는 우측에
                sortedGroup.splice(anchorIndex + 1, 0, ...reorderedPartners);
              }
              return; // 처리 완료 후 다음 그룹으로 넘어가기
            }
          }
        }
        // 형제를 못 찾거나 단독 노드인 경우 임시 보관
        unplacedNodes.push(...reorderedPartners);
      });
      // 3. 어디에도 배치되지 않은 노드들은 display_order가 뒤로 가도록 추가
      sortedGroup.push(...unplacedNodes);
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

  // [C-3] subRow 계산: 세대 내 줄(0=형제자매 줄, 1=IP 부부 줄)을 파생한다.
  // 멱등성 보장을 위해 항상 전체 노드를 subRow=0으로 초기화한 뒤 재계산한다.
  nodes.forEach(n => { n.subRow = 0; });
  if (hasGen0Siblings) {
    nodes.forEach(n => {
      if (n.relLevel === 0 && coupleIds.has(n.id)) n.subRow = 1;
    });
    const allLevels = Object.keys(levelGroups).map(Number);
    const maxLevel = allLevels.length > 0 ? Math.max(...allLevels) : 0;
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const levelNodes = nodes.filter(n => n.relLevel === lvl);
      if (levelNodes.length === 0) continue;
      // (1) 원가족 유닛(자기가 child로 속한 유닛)이 있는 노드: 그 유닛 부모들의 subRow 최댓값을 따른다.
      levelNodes.forEach(node => {
        const originUnit = familyUnits.find(fu => fu.childGroups?.some(cg => cg.child_ids.includes(node.id)));
        if (!originUnit) return; // (2)에서 처리
        const parentSubRows = originUnit.parent_ids
          .map(pid => nodeMap.get(pid))
          .filter((p): p is PersonNode => !!p)
          .map(p => p.subRow ?? 0);
        if (parentSubRows.length > 0) node.subRow = Math.max(...parentSubRows);
      });
      // (2) 원가족 유닛이 없는 노드(결혼해 들어온 배우자): 같은 유닛 상대 부모(파트너)의 subRow를 따른다.
      // 반드시 (1)이 이 레벨의 원가족 자녀를 모두 확정한 뒤에 처리한다(파트너 먼저 확정).
      levelNodes.forEach(node => {
        const originUnit = familyUnits.find(fu => fu.childGroups?.some(cg => cg.child_ids.includes(node.id)));
        if (originUnit) return; // (1)에서 이미 처리됨
        const marriedUnit = familyUnits.find(fu => fu.parent_ids.includes(node.id));
        if (!marriedUnit) return;
        const partnerID = marriedUnit.parent_ids.find(pid => pid !== node.id);
        const partnerNode = partnerID ? nodeMap.get(partnerID) : null;
        if (partnerNode) node.subRow = partnerNode.subRow ?? 0;
      });
    }
    // relLevel < 0(원가족 윗 세대)은 항상 subRow=0 유지
    nodes.forEach(n => { if (n.relLevel < 0) n.subRow = 0; });
  }

  // [#8] 미배치 노드 fallback: 어느 버킷에도 잡히지 않아 display_order가 -1로 남은
  // 노드를 같은 세대의 끝에 순차 배치하여 -1끼리 겹치지 않도록 한다.
  Object.keys(levelGroups).map(Number).forEach(level => {
    const placed = nodes.filter(n => n.relLevel === level && n.display_order >= 0);
    const unplaced = nodes.filter(n => n.relLevel === level && n.display_order < 0);
    if (unplaced.length === 0) return;
    let next = placed.length > 0 ? Math.max(...placed.map(n => n.display_order)) + 1 : 0;
    unplaced
      .sort((a, b) => (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0))
      .forEach(n => { n.display_order = next++; });
  });

  return { ...data, nodes };
}
