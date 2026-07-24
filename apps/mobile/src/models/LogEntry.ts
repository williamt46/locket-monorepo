import { ImportSource } from './ImportTypes';

export type BleedingIntensity = 'spotting' | 'light' | 'medium' | 'heavy';
export type SymptomKey =
  // Physical
  | 'cramps' | 'bloating' | 'nausea' | 'fatigue' | 'headache' | 'back_pain' | 'acne' | 'breast_tenderness'
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
  /**
   * Provenance of an imported entry ('clue' | 'flo' | 'csv' | 'healthkit' |
   * 'unknown'). Copied from the import-domain LedgerEntry.source in
   * ledgerEntryToLogEntry so a record's origin survives into the app domain.
   * Absent on entries the user created by hand.
   */
  source?: ImportSource;
}

export type TemperatureUnit = 'F' | 'C';

/**
 * Retired SymptomKey → its replacement(s).
 *
 * `nausea_fatigue` was split into the separate `nausea` and `fatigue` pills.
 * Entries saved before the split still carry the old key; map it to BOTH new
 * pills so the original "logged nausea and fatigue" intent survives the split.
 */
const LEGACY_SYMPTOM_KEYS: Record<string, SymptomKey[]> = {
  nausea_fatigue: ['nausea', 'fatigue'],
};

/**
 * Normalize a stored symptoms array on read: expand any retired keys to their
 * current equivalents and drop duplicates, preserving first-seen order. Current
 * keys pass through untouched. Used when hydrating a saved LogEntry into the
 * editor so historical entries keep showing (and stay editable as) real pills.
 */
export function migrateLegacySymptomKeys(symptoms: readonly SymptomKey[]): SymptomKey[] {
  const out: SymptomKey[] = [];
  const seen = new Set<SymptomKey>();
  for (const key of symptoms) {
    const replacements = LEGACY_SYMPTOM_KEYS[key] ?? [key];
    for (const r of replacements) {
      if (!seen.has(r)) {
        seen.add(r);
        out.push(r);
      }
    }
  }
  return out;
}
