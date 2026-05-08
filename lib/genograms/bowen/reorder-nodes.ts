import { BWGenogramData, PersonNode, FamilyUnit, RelationshipLink } from '@/types/bowengenogram.types';

export function reorderDisplayOrders(data: BWGenogramData): BWGenogramData {
  console.log("data :", JSON.stringify(data));
  const nodes = [...data.nodes];
  const familyUnits = data.familyUnits || [];
  const links = data.links || [];

  // 노드 검색을 위한 Map
  const nodeMap = new Map<string, PersonNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // 세대(relLevel)별 노드 배열 (정렬된 ID를 저장)
  const levelArrays: Record<number, string[]> = {};

  // 1. IP 찾기
  const ipNode = nodes.find(n => n.attributes.is_ip);
  if (!ipNode) return data; // IP가 없으면 원본 반환

  // ---------------------------------------------------------
  // [Step 2~5] 중심 세대 (relLevel === 0) 배열 구성
  // ---------------------------------------------------------
  
  // 2. IP 부부 배열 초기화
  let ipId = ipNode.id;
  let gen0Array: string[] = [ipId];
  
  // IP가 속한 (부모로서의) FamilyUnit을 찾아 배우자 확인
  const ipFamily = familyUnits.find(fu => fu.parent_ids.includes(ipId));
  
  let spouseId: string | null = null;
  if (ipFamily) {
    spouseId = ipFamily.parent_ids.find(id => id !== ipId) || null;
    if (spouseId)
      gen0Array.push(spouseId);
  };
  // console.log("[Step 2]gen0Array", gen0Array);

  // 3. 형제자매 추가 (FamilyUnit 기반)
  const addSiblings = (targetId: string) => {
    // 타겟이 자녀로 속한 FamilyUnit 찾기
    const originFamily = familyUnits.find(fu => fu.children_ids.includes(targetId));
    if (!originFamily) return [];

    const siblings = originFamily.children_ids; // 이미 나이순 정렬됨
    return siblings;
  };

  const ipSiblings = addSiblings(ipId);
  const spouseSiblings = spouseId ? addSiblings(spouseId) : [];
  
  // IP와 배우자의 형제자매를 좌우로 병합
  // [IP 형제자매(IP 포함)] + [배우자 형제자매(배우자 포함)]
  gen0Array = Array.from(new Set([...ipSiblings, ...spouseSiblings]));
  // console.log("[Step 3]gen0Array", gen0Array);

  // 4. 추가된 형제자매들의 배우자를 "남-녀" 순으로 삽입
  const insertSpouses = (baseArray: string[]) => {
    const newArray: string[] = [];
    baseArray.forEach(id => {
      const node = nodeMap.get(id);
      if (!node) return;
      if (id === ipId || id === spouseId) {
        newArray.push(id);
      } else {
        const fu = familyUnits.find(f => f.parent_ids.includes(id));
        if (fu) {
          const partnerId = fu.parent_ids.find(pId => pId !== id);
          const partnerNode = partnerId ? nodeMap.get(partnerId) : null;
          
          if (partnerNode && !newArray.includes(id) && !newArray.includes(partnerNode.id)) {
            // 남-녀 순서 삽입
            if (node.gender === 'male') {
              newArray.push(node.id, partnerNode.id);
            } else {
              newArray.push(partnerNode.id, node.id);
            }
          } else if (!newArray.includes(id)) {
            newArray.push(id);
          }
        } else if (!newArray.includes(id)) {
          newArray.push(id);
        }
      }
    });
    const missingNodes = nodes
      .filter(p => p.relLevel === 0 && !newArray.includes(p.id))
      .map(n => n.id);
    missingNodes.forEach(p => newArray.push(p));
    return newArray;
  };

  gen0Array = insertSpouses(gen0Array);
  // console.log("[Step 4]gen0Array", gen0Array);

  // 5. 지인들(FamilyUnit에 속하지 않은 링크된 노드) 추가 (우측 배치)
  // (생략: 필요에 따라 links 배열을 순회하며 gen0Array 끝에 push)

  // 0세대 입력
  levelArrays[0] = gen0Array;
  
  const allLevels = Array.from(new Set(nodes.map(n => n.relLevel)))
    .sort((a,b) => Math.abs(a) - Math.abs(b));

  allLevels.forEach(level => {
    if (level === 0) return;
    const currentLevelArray: string[] = [];
    const isPositive = level > 0; // 부모 세대인지 자녀 세대인지 확인
    const parentLevel = isPositive ? level - 1: level + 1;
    const baseArray = levelArrays[parentLevel] || [];
    baseArray.forEach(baseId => {
      if (isPositive) {
        // 자녀 방향 확장
        const family = familyUnits.find(fu => fu.parent_ids.includes(baseId));
        if (family) {
          family.children_ids.forEach(childId => {
            if (!currentLevelArray.includes(childId)) currentLevelArray.push(childId);
          })
        }
      } else {
        // 부모 방향 확장
        const family = familyUnits.find(fu => fu.children_ids.includes(baseId));
        if (family) {
          const [p1, p2] = family.parent_ids;
          const n1 = nodeMap.get(p1);
          const n2 = p2 ? nodeMap.get(p2) : null;
          if (n1 && !currentLevelArray.includes(n1.id)) {
            if (n2) {
              if (n1.gender === 'male') {
                currentLevelArray.push(n1.id, n2.id);
              } else {
                currentLevelArray.push(n2.id, n1.id);
              }
            } else {
              currentLevelArray.push(n1.id);
            }
          }
        }
      }
    }); // end baseArray
    const missingNodes = nodes
      .filter(p => p.relLevel === level && !currentLevelArray.includes(p.id))
      .map(n => n.id);
    levelArrays[level] = [...currentLevelArray, ...missingNodes];
  })
 

  // ---------------------------------------------------------
  // 최종: 계산된 배열의 Index를 display_order에 할당
  // ---------------------------------------------------------
  const updatedNodes = nodes.map(node => {
    const levelArr = levelArrays[node.relLevel] || [];
    const orderIndex = levelArr.indexOf(node.id);
    
    return {
      ...node,
      display_order: orderIndex !== -1 ? orderIndex + 1 : 999, // 배열에 없으면 맨 끝으로
    };
  });

  // 세대나 relLevel별 노드 수
  const levelCounts = updatedNodes.reduce((acc, node) => {
    acc[node.relLevel] = (acc[node.relLevel] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  // IP부터 가까운 순서 정렬
  const sortedLevels = Object.keys(levelCounts)
    .map(Number)
    .sort((a, b) => {
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      if (absA === absB) return a - b; 
      return absA - absB;
    });
  const sortedLevelsBySize = Object.keys(levelCounts)
    .map(Number)
    .sort((a, b) => {
      // 1. 가장 큰 값을 가진 키(maxSizeOfLevel)를 0번 인덱스로 고정
      const maxVal = Math.max(...Object.values(levelCounts));
      const isAMax = levelCounts[a] === maxVal;
      const isBMax = levelCounts[b] === maxVal;

      if (isAMax && !isBMax) return -1;
      if (!isAMax && isBMax) return 1;

      // 2. 나머지는 절대값이 작은 순(0에 가까운 순)으로 정렬
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      
      if (absA !== absB) {
        return absA - absB;
      }
      
      // 절대값이 같을 경우(예: -1과 1) 음수를 우선 배치 (선택 사항)
      return a - b;
    });
  const maxSizeOfLevel = sortedLevelsBySize[0];
  console.log("levelCounts: ",levelCounts);
  console.log("sortedLevels: ",sortedLevels);
  console.log("sortedLevelsBySize:",sortedLevelsBySize)
  const maxNodesCountInRelLevel = Math.max(...Object.values(levelCounts));
  // 캔버스 넓이 및 중앙점 계산
  const sideOffset = 100 * 2;
  const nodeArea = 160;
  const halfNodeArea = nodeArea/2;
  const dynamicWidth = maxNodesCountInRelLevel * nodeArea + sideOffset;
  const canvasWidth = Math.max(1200, dynamicWidth);
  const centerX = canvasWidth / 2;
  const minY = Math.min(...data.nodes.map(n => n.relLevel));

  // 노드 ID별 최종 좌표를 임시 저장할 맵
  const positionMap: Record<string, { x: number; y: number }> = {};
  let missingConnectCount = 0;
  // IP가 가장 가까운 세대부터 x좌표 계산
  sortedLevelsBySize.forEach((relLevel, sortedLevelIndex) => {
    console.log(`relLevel :${relLevel} `);
    const y = (relLevel - minY) * 160 + 100;
    const sameRowNodes = Array.from(
      new Set( updatedNodes.filter( p => p.relLevel === relLevel ))
    );
    console.log("sameRowNodes: ",sameRowNodes)
    if (relLevel === maxSizeOfLevel) {
      // 가장 많은 노드가 포함된 세대
      sameRowNodes.forEach((node,index) => {
        const offset = node.display_order * nodeArea;
        positionMap[node.id] = {x: offset, y: y};
        console.log(`positionMap[${node.id}] : x: ${positionMap[node.id].x}, y: ${positionMap[node.id].y}`);
      });
      console.log("idxZero :: positionMap:",positionMap);
    } else {
      // 다른 노드들은 기준 세대를 비교대상으로 위치 설정
      if (relLevel < maxSizeOfLevel) {
        // 자녀 노드를 찾아서 중앙값 계산 
        sameRowNodes.forEach((node) => {
          const family = data.familyUnits.find(p => p.parent_ids.includes(node.id));
          if (family) {
            const leftPosition = positionMap[family.children_ids[0]];
            const rightPosition = positionMap[family.children_ids[family.children_ids.length-1]];
            
            const familyCenterX = leftPosition.x + (rightPosition.x-leftPosition.x)/2;
            
            if (node.gender === 'male') {
              positionMap[node.id] = {x: familyCenterX - halfNodeArea, y: y};
            } else if (node.gender === 'female') {
              positionMap[node.id] = {x: familyCenterX + halfNodeArea, y:y};
            } else {
              positionMap[node.id] = {x: familyCenterX, y:y};
            }
            console.log(`positionMap[${node.id}] : x: ${positionMap[node.id].x}, y: ${positionMap[node.id].y}`);
          }
        });
      } else {
        // 부모 노드를 찾아서 중앙값 계산
        sameRowNodes.forEach((node) => {
          const family = data.familyUnits.find(p => p.children_ids.includes(node.id));

          if (family && family.parent_ids.length >= 2) {
            const p1 = updatedNodes.find(p => p.id === family.parent_ids[0]);
            const p2 = updatedNodes.find(p => p.id === family.parent_ids[1]);
            let hasMemberInBetween = false;
            if (p1 && p2) {
              const minOrder = Math.min(p1.display_order, p2.display_order);
              const maxOrder = Math.max(p1.display_order, p2.display_order);
              console.log(`p ids :: [${p1.id}, ${p2.id}] :: p order ${minOrder} -> ${maxOrder}`);

              // 부모 order를 기준으로 그 사이에 자녀가 있는 가족 단위가 있는지 확인
              hasMemberInBetween = updatedNodes.some(p => 
                (p.relLevel === p1.relLevel || p.relLevel === p2.relLevel) &&
                (p.display_order > minOrder && p.display_order <= maxOrder) &&
                (p.display_order >= minOrder && p.display_order < maxOrder)
              );
            }
            console.log(`node id : ${node.id}:: hasMemberInBetween::${hasMemberInBetween}`)
            const pPos1 = positionMap[family.parent_ids[0]];
            const pPos2 = positionMap[family.parent_ids[1]];
            console.log(`pPos1 : ${pPos1}, pPos2 : {${pPos2}`);
            if (pPos1 && pPos2) {
              const leftPosX = Math.min(pPos1.x, pPos2.x);
              const rightPosX = Math.max(pPos1.x, pPos2.x);
              const familyCenterX = leftPosX + (rightPosX - leftPosX)/2;
  
              // 형제자매가 홀수인지 짝수인지 확인
              const childrenCount = family.children_ids.length;
              const isOdd = childrenCount % 2 !== 0;
              if (childrenCount === 1) {
                positionMap[node.id] = {x: familyCenterX, y: hasMemberInBetween ? 160+y:y};
              } else {
                const childrenCenterOrder = (childrenCount+1) / 2;
                const birthOrderGap = childrenCenterOrder- node.attributes.birth_order;
                const childrenOffset = isOdd ? 0 : birthOrderGap > 0 ? halfNodeArea : -halfNodeArea;
                
                const childrenOrderGap = birthOrderGap*nodeArea + childrenOffset;
                console.log(`id: ${node.id},\nchildrenCenterOrder: ${childrenCenterOrder}\nbirthOrderGap:${birthOrderGap}\ngap : ${childrenOrderGap}\nchildrenOffset: ${childrenOffset}`);
                positionMap[node.id] = {
                  x: familyCenterX + childrenOrderGap,
                  y: hasMemberInBetween ? 160+y:y
                }
              };
            } else {
            }
            
          } else {
            // 부모 노드가 없는 지인
            console.log("부모 노드가 없는 지인 2: id: ",node.id);
            const connection = data.links.find(l => l.from === node.id || l.to === node.id);
            const targetId = connection ? (connection.from === node.id ? connection.to : connection.from) : null;
            const targetNode = targetId ? updatedNodes.find(p => p.id === targetId) : null;
            if (targetNode && positionMap[targetNode.id]) {
              const orderDiff = node.display_order - targetNode.display_order;
              positionMap[node.id] = {
                x: positionMap[targetNode.id].x + (orderDiff * nodeArea),
                y: y
              };
            } else {
              missingConnectCount += 1;
              positionMap[node.id] = {
                x: canvasWidth - (node.display_order * nodeArea),
                y: y
              };
            }
          }
        })
      }
    }
  });

  

  return {
    ...data,
    nodes: updatedNodes.map(v => ({
      ...v,
      layoutPosition: positionMap[v.id] ?? {x:0, y:0}
    })),
    canvasSize: {
      width: canvasWidth,
      height: 800
    }
  };
}