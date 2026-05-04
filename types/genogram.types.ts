export type PersonStatus = 'alive' | 'deceased' | 'fetus' | 'unknown';
export type Gender = 'male' | 'female' | 'other' | 'unknown';

export interface GenogramNode {
  id: string;
  name: string;
  gender: Gender;
  status: PersonStatus;
  
  // 세대 및 위치
  relLevel: number; // 0: 대상자, 음수: 윗세대, 양수: 아랫세대
  side: 'paternal' | 'maternal' | 'center' | 'unknown'; 
  isProband: boolean;

  // 관계: FamilyUnit의 ID를 참조하여 선을 연결
  parentsFamilyId?: string; // 내가 자녀로서 속한 가족 (부모님의 결혼선과 연결)
  ownFamilyIds?: string[];  // 내가 부모로서 만든 가족 (나와 배우자의 결혼선)

  metadata?: {
    birthDate?: string;
    deathDate?: string;
    notes?: string;
    [key: string]: any;
  };
}

export interface FamilyUnit {
  id: string;
  level: number; // 해당 가족이 위치한 세대 레벨
  fatherId?: string; // 모르는 경우 undefined (미상 처리)
  motherId?: string; // 모르는 경우 undefined (미상 처리)
  childrenIds: string[];
  relationshipType: 'married' | 'divorced' | 'unmarried' | 'unknown';
}

export interface GenogramData {
  nodes: GenogramNode[];
  families: FamilyUnit[]; // 가족 단위 리스트 추가
}