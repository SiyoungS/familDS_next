import { BWGenogramData, PersonNode, FamilyUnit } from '@/types/bowengenogram.types';

/**
 * relLevel을 가족 구조(familyUnits)로부터 결정적으로 재계산한다.
 *
 * LLM이 매번 다른 relLevel(특히 형제자매를 -1로 잘못 매기는 오류)을 내더라도,
 * 부모-자식 관계 그래프만으로 IP(0)를 기준으로 세대를 전파하면
 * 결과가 항상 일정하고, 같은 부모의 자식(형제자매)은 반드시 동일한 레벨이 된다.
 *
 * 전파 규칙:
 *  - 같은 FamilyUnit의 parent_ids(부부)는 동일 레벨
 *  - childGroups의 자녀는 부모보다 +1 레벨 (= 형제자매끼리 동일 레벨)
 *  - IP는 항상 0
 *
 * IP를 찾을 수 없거나 그래프에서 도달하지 못한 노드는 기존 relLevel을 유지한다.
 */
export function normalizeRelLevels(data: BWGenogramData): BWGenogramData {
  const nodes = JSON.parse(JSON.stringify(data.nodes)) as PersonNode[];
  const units = (data.familyUnits || []) as FamilyUnit[];

  const ip = nodes.find((n) => n.attributes?.is_ip);
  if (!ip) {
    console.warn('normalizeRelLevels: IP 노드를 찾지 못해 relLevel 재계산을 건너뜁니다.');
    return data;
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const childIdsOf = (u: FamilyUnit) => (u.childGroups || []).flatMap((cg) => cg.child_ids);

  const level = new Map<string, number>();
  level.set(ip.id, 0);
  const queue: string[] = [ip.id];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curLevel = level.get(cur)!;

    const assign = (id: string, lvl: number) => {
      if (!nodeIds.has(id) || level.has(id)) return;
      level.set(id, lvl);
      queue.push(id);
    };

    for (const unit of units) {
      const parents = unit.parent_ids || [];
      const children = childIdsOf(unit);

      if (parents.includes(cur)) {
        // 배우자는 동일 레벨, 자녀는 +1 레벨
        parents.forEach((pid) => assign(pid, curLevel));
        children.forEach((cid) => assign(cid, curLevel + 1));
      }
      if (children.includes(cur)) {
        // 형제자매는 동일 레벨, 부모는 -1 레벨
        children.forEach((cid) => assign(cid, curLevel));
        parents.forEach((pid) => assign(pid, curLevel - 1));
      }
    }
  }

  nodes.forEach((n) => {
    const lvl = level.get(n.id);
    if (lvl !== undefined && n.relLevel !== lvl) {
      console.log(`normalizeRelLevels: ${n.name} relLevel ${n.relLevel} -> ${lvl}`);
      n.relLevel = lvl;
    }
  });

  return { ...data, nodes };
}
