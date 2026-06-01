import { Type } from "@google/genai";

export const bwGenogramSchema = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          gender: { type: Type.STRING, enum: ['male', 'female', 'unknown', 'pet'] },
          type: { type: Type.STRING, enum: ['person', 'fetus', 'miscarriage', 'abortion', 'stillbirth'] },
          attributes: {
            type: Type.OBJECT,
            properties: {
              is_ip: { type: Type.BOOLEAN },
              is_spouse_of_ip: { type: Type.BOOLEAN },
              is_deceased: { type: Type.BOOLEAN },
              death_cause: { type: Type.STRING },
              orientation: { type: Type.STRING, enum: ['homosexual', 'bisexual'] },
              transgender: { type: Type.STRING, enum: ['m_to_f', 'f_to_m'] },
              health_status: {
                type: Type.OBJECT,
                properties: {
                  physical_mental_illness: { type: Type.BOOLEAN },
                  illness_recovery: { type: Type.BOOLEAN },
                  substance_abuse: { type: Type.BOOLEAN },
                  substance_recovery: { type: Type.BOOLEAN },
                  abuse_suspected: { type: Type.BOOLEAN },
                },
                required: ["physical_mental_illness", "illness_recovery", "substance_abuse", "substance_recovery", "abuse_suspected"]
              },
              birth_date: { type: Type.STRING },
              death_date: { type: Type.STRING },
              age: { type: Type.NUMBER },
              birth_order: { type: Type.NUMBER },
              primary_family_unit_id: { type: Type.STRING },
            },
            required: ["is_ip", "is_spouse_of_ip", "is_deceased"]
          },
          relLevel: { type: Type.NUMBER },
        },
        required: ["id", "name", "gender", "type", "attributes", "relLevel"]
      }
    },
    childGroups: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          child_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          type: { type: Type.STRING, enum: ['normal', 'identical_twins', 'fraternal_twins', 'triplets'] },
        },
        required: ["child_ids", "type"]
      }
    },
    familyUnits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          parent_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          childGroups: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                child_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                type: { type: Type.STRING, enum: ['normal', 'identical_twins', 'fraternal_twins', 'triplets'] }
              }
            }
          },
          legal_status: { type: Type.STRING, enum: ['married', 'divorced', 'separated', 'common_law', 'null'] },
          marriage_order: { type: Type.NUMBER },
          marriage_year: { type: Type.NUMBER },
          divorce_year: { type: Type.NUMBER },
        },
        required: ["id", "parent_ids", "childGroups", "legal_status", "marriage_order"]
      }
    },
    links: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          emotional_status: { type: Type.STRING, enum: ['normal', 'fused', 'conflictual', 'fused_conflictual', 'distant', 'cut_off', 'triangle'] },
          special_type: { type: Type.STRING, enum: ['adopted', 'foster'] },
        },
        required: ["id", "from", "to", "emotional_status"]
      }
    },
    households: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          member_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          label: { type: Type.STRING },
          stroke_style: { type: Type.STRING, enum: ['dashed', 'solid'] },
        },
        required: ["id", "member_ids", "stroke_style"]
      }
    }
  },
  required: ["nodes", "familyUnits", "links", "households"]
};