// Phase mapping: CyclePhase string → array of Euki item IDs
// CyclePhase values: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'unknown'
export const PHASE_MAPPING: Record<string, string[]> = {
  menstrual: ['menstrual_what_happens', 'menstrual_cramps', 'menstrual_bloating', 'menstrual_nausea'],
  follicular: ['follicular_what_happens', 'follicular_mood'],
  ovulatory: ['ovulatory_what_happens', 'ovulatory_signs'],
  luteal: ['luteal_what_happens', 'luteal_pms', 'luteal_mood'],
  unknown: [],
};
