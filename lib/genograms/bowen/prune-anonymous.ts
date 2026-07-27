import { BWGenogramData, ChildGroup, FamilyUnit, HouseholdGroup, PersonNode, RelationshipLink } from '@/types/bowengenogram.types';

/**
 * LLM이 가계도 "구조"를 채우기 위해 만들어낸 `익명(...)` 노드의 이름을, 본문에 쓰인
 * 지칭(관계 표현) 그대로의 이름으로 바꾼다. **노드를 절대 제거하거나 블랭크로
 * 지우지 않는다** (괄호 없는 단독 "익명"만 예외 — 아래 참고).
 *
 * 배경: Gemini는 실제 인물 정보가 없어도 세대/형제 구조를 완성하려고
 * `익명(김철수의 할아버지)` 같은 더미 이름을 붙인 노드를 생성한다. 실사용 상담
 * 사례에서는 실명이 전혀 등장하지 않는 경우도 흔하다 — 이때는 "언급된 형제 3명·
 * 자녀 2명·배우자의 형제" 같은 실존 인물 전원이 `익명(...)`으로 채워지므로,
 * 이름을 지워버리면(구 버전 blankAnonymousNames) IP 외 전원의 이름표가 화면에서
 * 사라진다. 사용자는 실명이 없더라도 본문에 쓰인 지칭(배우자, 첫째언니, 아버지 등)을
 * 그대로 이름으로 보길 원한다.
 *
 * 동작:
 * 1. `/^\s*익명/`에 매치하지 않는 이름은 그대로 둔다.
 * 2. 매치하되 `익명(...)` 형태로 괄호가 있으면, 괄호 안의 지칭 문구를 추출하고
 *    그 앞에 붙은 "IP 이름(의)?" 접두를 한 번만 제거해 name으로 쓴다.
 *    - IP는 `nodes.find(n => n.attributes?.is_ip)`, IP 기본이름은 `ip.name`에서
 *      끝의 괄호 접미(`"(IP)"` 등)를 제거해 구한다.
 *    - 예: `"김O영(IP)"` 기준 — `"익명(김O영의 배우자)"` → `"배우자"`,
 *      `"익명(김O영의 첫째언니)"` → `"첫째언니"`,
 *      `"익명(김O영 배우자의 아버지)"` → `"배우자의 아버지"`,
 *      `"익명(김O영의 자녀1)"` → `"자녀1"`.
 *    - 괄호 안 문구가 IP 기본이름으로 시작하지 않으면 접두 제거 없이 괄호 안
 *      내용 그대로 사용한다.
 *    - 변환 결과가 빈 문자열이면 `''`.
 * 3. 괄호가 없는 단독 `익명`(관계 지칭을 추출할 수 없음)은 기존처럼 `''`로
 *    블랭크 처리한다(렌더러가 빈 이름이면 이름표 라벨을 생략 → "빈 도형 + 가족선/
 *    정서선"으로만 표시).
 *
 * 노드/유닛/링크/households는 어떤 것도 제거하지 않는다(개수 불변).
 *
 * 멱등성: resolveAnonymousNames(resolveAnonymousNames(x))는 resolveAnonymousNames(x)와
 * 동일하다. 변환 결과("첫째언니", "배우자의 아버지" 등)와 블랭크 결과(`''`)는 모두
 * `/^\s*익명/`에 매치하지 않으므로 재실행해도 더 이상 바뀌지 않는다.
 *
 * @param data 원본 BWGenogramData (변경하지 않음 — 깊은 복사 후 처리)
 * @returns 익명 노드의 이름이 관계 지칭(또는 빈 문자열)으로 바뀐 새 BWGenogramData
 */
// LLM이 만든 '익명(...)' 더미 이름 판별 정규식. GenogramCanvas.tsx의 이름표 렌더링(빈 이름 →
// 라벨 생략)과 동일 기준을 공유하도록 export한다.
export const ANONYMOUS_NAME_PATTERN = /^\s*익명/;

// "익명(...)" 형태에서 괄호 안 지칭 문구를 추출하는 정규식.
const ANONYMOUS_LABEL_PATTERN = /^\s*익명\s*\(([\s\S]*)\)\s*$/;

// IP 이름 끝에 붙는 괄호 접미(예: "김O영(IP)"의 "(IP)")를 제거하기 위한 정규식.
const TRAILING_PAREN_SUFFIX_PATTERN = /\s*\([^()]*\)\s*$/;

// 정규식 메타문자를 이스케이프해 문자열을 리터럴로 안전하게 패턴에 삽입한다.
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveAnonymousNames(data: BWGenogramData): BWGenogramData {
  const cloned = JSON.parse(JSON.stringify(data)) as BWGenogramData;
  const nodes = cloned.nodes || [];

  const ip = nodes.find((n) => n.attributes?.is_ip);
  const ipBaseName = ip ? ip.name.replace(TRAILING_PAREN_SUFFIX_PATTERN, '').trim() : '';
  const prefixPattern = ipBaseName ? new RegExp(`^${escapeRegExp(ipBaseName)}(의)?\\s*`) : null;

  cloned.nodes = nodes.map((n) => {
    if (!ANONYMOUS_NAME_PATTERN.test(n.name)) return n;

    const labelMatch = n.name.match(ANONYMOUS_LABEL_PATTERN);
    if (!labelMatch) return { ...n, name: '' }; // 괄호 없는 단독 "익명" → 블랭크

    let label = labelMatch[1].trim();
    if (prefixPattern) {
      label = label.replace(prefixPattern, '');
    }
    return { ...n, name: label };
  });

  return cloned;
}

/**
 * 주어진 노드 id 집합(removedIds)을 데이터에서 완전히 제거하고, 그에 연쇄되는
 * FamilyUnit / RelationshipLink / HouseholdGroup을 정리한 새 BWGenogramData를 반환한다.
 *
 * resolveAnonymousNames는 노드를 제거하지 않지만, 다른 호출부(예: GenogramCanvas의
 * "친정 부모 표시" 토글)는 여전히 특정 노드 집합을 구조적으로 완전히 제거해야 하므로
 * 이 헬퍼는 그대로 export해 재사용한다.
 *
 * @param data 원본 BWGenogramData (변경하지 않음)
 * @param removedIds 완전히 제거할 노드 id 집합
 * @returns 제거·정리가 반영된 새 BWGenogramData
 */
export function removeNodesFromData(data: BWGenogramData, removedIds: Set<string>): BWGenogramData {
  const nodes = data.nodes || [];
  const units = data.familyUnits || [];

  const resultNodes: PersonNode[] = nodes.filter((n) => !removedIds.has(n.id));

  const resultUnits: FamilyUnit[] = units
    .map((unit) => {
      const parent_ids = (unit.parent_ids || []).filter((id) => !removedIds.has(id));
      const childGroups: ChildGroup[] = (unit.childGroups || [])
        .map((cg) => ({ ...cg, child_ids: cg.child_ids.filter((id) => !removedIds.has(id)) }))
        .filter((cg) => cg.child_ids.length > 0);
      return { ...unit, parent_ids, childGroups };
    })
    // parent_ids가 1명 이하이면서 남은 자녀도 없는 유닛만 삭제(부모 0명 + 자녀 존재 유닛은 유지).
    .filter((unit) => !(unit.parent_ids.length <= 1 && unit.childGroups.length === 0));

  const resultLinks: RelationshipLink[] = (data.links || []).filter(
    (l) => !removedIds.has(l.from) && !removedIds.has(l.to)
  );

  const resultHouseholds: HouseholdGroup[] | undefined = data.households
    ? data.households.map((h) => ({
        ...h,
        members: (h.members || []).filter((id) => !removedIds.has(id)),
        member_ids: h.member_ids ? h.member_ids.filter((id) => !removedIds.has(id)) : h.member_ids,
      }))
    : data.households;

  return {
    ...data,
    nodes: resultNodes,
    familyUnits: resultUnits,
    links: resultLinks,
    households: resultHouseholds,
  };
}
