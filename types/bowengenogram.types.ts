// types/bowen-genogram.types.ts

// 보웬 가계도 데이터의 최상위 구조
export interface BWGenogramData {
  nodes: PersonNode[];
  links: RelationshipLink[];
  familyUnits: FamilyUnit[];
  households?: HouseholdGroup[];

  // layout에 사용될 기본 변수
  canvasSize: {
    width: number;
    height: number;
  }
}

// 개별 인물(노드) 정보
export interface PersonNode {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'unknown' | 'pet'; // 반려동물(마름모) 추가
  type: 'person' | 'fetus'; // 태아(삼각형) 추가
  
  attributes: {
    is_ip: boolean; // 내담자 본인: 중심인물(이중 테두리, 배경색)
    is_spouse_of_ip: boolean; // 내담자의 배우자
    is_deceased: boolean;   // 사망(X 표시)
    
    // 성적 지향 및 성전환 (이미지 좌측 하단 반영)
    orientation?: 'homosexual' | 'bisexual'; // 기호 안 역삼각형
    transgender?: 'm_to_f' | 'f_to_m';       // 기호 안의 기호
    
    // 질병 및 중독 상태 (이미지 우측 상세 반영)
    // SVG에서 4등분 또는 2등분 색칠을 결정하는 데이터
    health_status?: {
      physical_mental_illness: boolean;    // 신체적·정신적 질병 (좌측 절반 색칠)
      illness_recovery: boolean;           // 질병 호전 (우측 상단 1/4 색칠)
      substance_abuse: boolean;            // 약물/알코올 남용 (하단 절반 색칠)
      substance_recovery: boolean;         // 남용에서 회복 (우측 하단 1/4 색칠)
      abuse_suspected: boolean;            // 남용 의심 (하단 빗금)
    };

    birth_date?: string;    // 기호 왼쪽 위
    death_date?: string;    // 기호 오른쪽 위
    birth_order: number;    // 가계도 가족단위 내에서 children의 출생 순서. 없으면 null. 태아도 null.
    age?: number;           // 기호 안쪽
  };
  relLevel: number; // 세대 및 상대적 위치 
  generation: number;
  display_order: number;
  layoutPosition: {
    x: number;
    y: number;
  }
}

// 인물 간의 관계(링크) 정보
export interface RelationshipLink {
  from: string; // 시작 인물 ID
  to: string;   // 대상 인물 ID
  
  // 법적/생물학적 상태 (주로 부부/부모-자녀 관계선 모양 결정)
  legal_status: 

    | 'married'    // 실선
    | 'divorced'   // 실선 위 사선 2개
    | 'separated'  // 실선 위 사선 1개

    | 'common_law' // 점선
    | 'parent_child' // 수직 연결선
    | 'foster'       // 위탁 양육 (외부 기관 연결 등)
    | 'guardianship' // 법적 후견 관계 (조부모, 친척 등이 법적 보호자일 때)
    | 'null';

  // 보웬의 핵심: 정서적 역동 (선의 스타일 결정)
  emotional_status: 

    | 'normal'            // 기본 실선
    | 'fused'             // 세 줄 실선 (밀착)
    | 'conflictual'       // 지그재그 선 (갈등)

    | 'fused_conflictual' // 세 줄 + 지그재그 (밀착된 갈등)
    | 'distant'           // 가는 점선 (소원함)
    | 'cut_off'           // 중간이 끊긴 선 (단절)
    | 'triangle';         // 삼각관계 (필요 시 별도 로직)
    
  metadata?: {
    date?: string;        // 결혼/이혼 시기 등
    description?: string; // 추가 설명
  };
}
export interface FamilyUnit {
  id: string; // "FU1", "FU2" 등
  parent_ids: string[]; // [부, 모] 또는 [파트너1, 파트너2]
  children_ids: string[]; // 출생 순서대로 정렬된 자녀들의 ID 배열
  legal_status: 'married' | 'divorced' | 'separated' | 'common_law' | 'null';
  marriage_year?: number;
}
/**
 * 동거 가족 범위를 표시하기 위한 그룹
 */
export interface HouseholdGroup {
  id: string;
  members: string[]; // 포함된 PersonNode ID 목록
  label?: string;    // 예: "현재 함께 거주"
}
