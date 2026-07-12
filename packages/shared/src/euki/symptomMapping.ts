// Symptom mapping: SymptomKey → Euki item ID
export const SYMPTOM_MAPPING: Record<string, string> = {
  cramps: 'menstrual_cramps',
  bloating: 'menstrual_bloating',
  nausea: 'menstrual_nausea',
  // Fatigue shares the 'menstrual_nausea' item — the content covers both (see
  // menstruation.ts "Period nausea and fatigue"), so a force-tap on either pill
  // surfaces the same Euki explanation.
  fatigue: 'menstrual_nausea',
  mood_low: 'luteal_pms',
  mood_anxious: 'symptom_mood_anxious',
  mood_irritable: 'symptom_mood_irritable',
  acne: 'luteal_acne',
  headache: 'symptom_headache',
  back_pain: 'symptom_back_pain',
  breast_tenderness: 'luteal_pms',
  // Sex + trigger keys intentionally omitted — no Euki content item for these
};
