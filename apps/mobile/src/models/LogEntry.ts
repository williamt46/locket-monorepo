export type BleedingIntensity = 'spotting' | 'light' | 'medium' | 'heavy';
export type SymptomKey =
  | 'cramps'
  | 'bloating'
  | 'nausea_fatigue'
  | 'mood_low'
  | 'mood_anxious'
  | 'mood_irritable'
  | 'acne'
  | 'headache'
  | 'back_pain';

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
}
