import type { EmotionalLinkResult } from './genai-emotions';

// [프롬프트 체이닝 2차] 정서 관계선 전담 추출 결과를 raw 구조의 links에 병합한다.
//
// 병합 전략: union + 전담 추출 우선.
//  - raw.links(1차 구조 추출 결과)는 그대로 유지한다.
//  - 추출된 각 링크는 무순서 쌍(from/to 순서 무관) 기준으로 기존 링크를 찾는다.
//    있으면 emotional_status를 추출 값으로 교체(전담 추출이 우선), 없으면 새 링크로 추가한다.
//    새 링크의 id는 기존 id와 충돌하지 않는 "EL1", "EL2" ... 형태로 부여한다.
//  - 추출된 from/to 중 하나라도 현재 nodes 목록에 없는 id면 그 링크는 버린다.
//
// 순수 함수: 네트워크/DB 호출 없이 전달된 data.nodes/data.links만 참조하며,
// data.links 배열을 직접 갱신(mutate)한 뒤 그 배열을 반환한다. (applyRelations와 동일한 스타일)
export function applyEmotions(
  data: {
    nodes?: { id: string }[];
    links?: { id: string; from: string; to: string; emotional_status: string }[];
  },
  emotionalLinks: EmotionalLinkResult[] | undefined | null
) {
  const links = data.links || (data.links = []);
  const validNodeIds = new Set((data.nodes || []).map((n) => n.id));
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');

  const existingIds = new Set(links.map((l) => l.id));
  let counter = 1;
  const generateId = () => {
    let id = `EL${counter}`;
    while (existingIds.has(id)) {
      counter++;
      id = `EL${counter}`;
    }
    existingIds.add(id);
    counter++;
    return id;
  };

  for (const el of emotionalLinks || []) {
    if (!el) continue;
    if (!validNodeIds.has(el.from) || !validNodeIds.has(el.to)) continue;

    const key = pairKey(el.from, el.to);
    const matches = links.filter((l) => pairKey(l.from, l.to) === key);

    if (matches.length > 0) {
      matches.forEach((m) => {
        m.emotional_status = el.emotional_status;
      });
    } else {
      links.push({
        id: generateId(),
        from: el.from,
        to: el.to,
        emotional_status: el.emotional_status,
      });
    }
  }

  return links;
}
