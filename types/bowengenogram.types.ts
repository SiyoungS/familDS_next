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
  // 태아, 유산, 낙태 등 기호 분리
  type: 'person' | 'fetus' | 'miscarriage' | 'abortion' | 'stillbirth';
  
  attributes: {
    is_ip: boolean; // 내담자 본인: 중심인물(이중 테두리)
    is_spouse_of_ip: boolean; // 내담자의 배우자
    is_deceased: boolean;   // 사망(X 표시)
    death_cause?: string; // 사망 원인(암, 사고 등)
    
    // 성적 지향 및 성전환 
    orientation?: 'homosexual' | 'bisexual'; // 기호 안 역삼각형
    transgender?: 'm_to_f' | 'f_to_m';       // 기호 안의 기호
    
    // 질병 및 중독 상태 - SVG에서 4등분 또는 2등분 색칠을 결정하는 데이터
    health_status?: {
      physical_mental_illness: boolean;    // 신체적·정신적 질병 (좌측 절반 색칠)
      illness_recovery: boolean;           // 질병 호전 (우측 상단 1/4 색칠)
      substance_abuse: boolean;            // 약물/알코올 남용 (하단 절반 색칠)
      substance_recovery: boolean;         // 남용에서 회복 (우측 하단 1/4 색칠)
      abuse_suspected: boolean;            // 남용 의심 (하단 빗금)
    };

    birth_date?: string;    // 기호 왼쪽 위
    death_date?: string;    // 기호 오른쪽 위
    age?: number;           // 기호 안쪽

    birth_order: number;    // 가계도 가족단위 내에서 children의 출생 순서. 없으면 null. 태아도 null.

    // 현재 어떤 유닛에 속해있는가를 알려주는 아이디.
    primary_family_unit_id?: string; // 레이아웃의 중심이 되는 가족 단위 ID
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
  id: string; // 관계 정보 ID
  from: string; // 시작 인물 ID
  to: string;   // 대상 인물 ID

  // 보웬의 핵심: 정서적 역동 (선의 스타일 결정)
  emotional_status: 

    | 'normal'            // 기본 실선
    | 'fused'             // 세 줄 실선 (밀착)
    | 'conflictual'       // 지그재그 선 (갈등)

    | 'fused_conflictual' // 세 줄 + 지그재그 (밀착된 갈등)
    | 'distant'           // 가는 점선 (소원함)
    | 'cut_off'           // 중간이 끊긴 선 (단절)
    | 'triangle';         // 삼각관계 (필요 시 별도 로직)
  
    // 입양/위탁 - 선 스타일
  special_type?: 'adopted' | 'foster';
  metadata?: {
    date?: string;        // 결혼/이혼 시기 등
    description?: string; // 추가 설명
  };
}
export interface FamilyUnit {
  id: string; // "FU1", "FU2" 등
  parent_ids: string[]; // [부, 모] 또는 [파트너1, 파트너2]
  childGroups: ChildGroup[]; // 출생 순서대로 정렬된 자녀들의 ID 배열
  legal_status: 'married' | 'divorced' | 'separated' | 'common_law' | 'null';
  
  marriage_order: number;   
  marriage_year?: number;
  divorce_year?: number;

  // 레이아웃 엔진용: 부부 연결 수평선의 중심 좌표
  lineCenterPosition?: { x: number; y: number };
  lineY?: number;
}
export interface ChildGroup {
  child_ids: string[];
  type: 'normal' | 'identical_twins' | 'fraternal_twins' | 'triplets';
}
/**
 * 동거 가족 범위를 표시하기 위한 그룹
 */
export interface HouseholdGroup {
  id: string;
  members: string[]; // 포함된 PersonNode ID 목록
  label?: string;    // 예: "현재 함께 거주"
  stroke_style: 'dashed' | 'solid'; // 경계선 스타일
}
