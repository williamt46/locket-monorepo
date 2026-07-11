export type BleedingIntensity = 'spotting' | 'light' | 'medium' | 'heavy';
export type SymptomKey =
  // Physical
  | 'cramps' | 'bloating' | 'nausea_fatigue' | 'headache' | 'back_pain' | 'acne' | 'breast_tenderness'
  // Mood
  | 'mood_low' | 'mood_anxious' | 'mood_irritable' | 'mood_happy' | 'mood_energized' | 'mood_calm'
  // Sex
  | 'sex_protected' | 'sex_unprotected' | 'sex_high_drive' | 'sex_low_drive'
  // Triggers
  | 'trigger_stress' | 'trigger_poor_sleep' | 'trigger_alcohol' | 'trigger_caffeine' | 'trigger_intense_exercise';

export interface LogEntry {
  event: 'period_start' | 'period_end' | 'manual_entry';
  date: string;        // ISO YYYY-MM-DD
  ts: number;          // Unix ms
  isPeriod?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  note?: string;
  bleeding?: { intensity: BleedingIntensity; clots?: 'small' | 'large' };
  symptoms?: SymptomKey[];
  /**
   * Basal body temperature, stored AS ENTERED (never normalized to a canonical
   * unit at write). Display converts to the user's active unit preference.
   * `null` is an explicit clear (distinct from `undefined` = never set).
   */
  temperature?: { value: number; unit: 'F' | 'C' } | null;
}

export type TemperatureUnit = 'F' | 'C';
