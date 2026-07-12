import { describe, it, expect } from 'vitest';
import type { LogEntry, SymptomKey, BleedingIntensity } from '../../src/index.js';

/**
 * Verifies that LogEntry — including the full expanded SymptomKey set —
 * survives a JSON serialize/deserialize roundtrip (the layer CloudBackupService
 * serializes before encrypting).
 */
describe('LogEntry backup/restore roundtrip', () => {
  const ALL_SYMPTOMS: SymptomKey[] = [
    // Physical
    'cramps', 'bloating', 'nausea', 'fatigue', 'headache', 'back_pain', 'acne', 'breast_tenderness',
    // Mood
    'mood_low', 'mood_anxious', 'mood_irritable', 'mood_happy', 'mood_energized', 'mood_calm',
    // Sex
    'sex_protected', 'sex_unprotected', 'sex_high_drive', 'sex_low_drive',
    // Triggers
    'trigger_stress', 'trigger_poor_sleep', 'trigger_alcohol', 'trigger_caffeine', 'trigger_intense_exercise',
  ];

  const ALL_BLEEDING_INTENSITIES: BleedingIntensity[] = ['spotting', 'light', 'medium', 'heavy'];

  it('all 23 SymptomKey values survive JSON roundtrip', () => {
    const entry: LogEntry = {
      event: 'manual_entry',
      date: '2026-04-14',
      ts: 1744584000000,
      symptoms: ALL_SYMPTOMS,
    };

    const restored: LogEntry = JSON.parse(JSON.stringify(entry));

    expect(restored.symptoms).toHaveLength(ALL_SYMPTOMS.length);
    for (const key of ALL_SYMPTOMS) {
      expect(restored.symptoms).toContain(key);
    }
  });

  it('no extra keys are injected during roundtrip', () => {
    const entry: LogEntry = {
      event: 'manual_entry',
      date: '2026-04-14',
      ts: 1744584000000,
      symptoms: ALL_SYMPTOMS,
    };

    const restored: LogEntry = JSON.parse(JSON.stringify(entry));

    expect(restored.symptoms).toHaveLength(ALL_SYMPTOMS.length);
  });

  it.each(ALL_BLEEDING_INTENSITIES)(
    'BleedingIntensity "%s" survives roundtrip',
    (intensity) => {
      const entry: LogEntry = {
        event: 'manual_entry',
        date: '2026-04-14',
        ts: 1744584000000,
        bleeding: { intensity, clots: 'small' },
      };

      const restored: LogEntry = JSON.parse(JSON.stringify(entry));

      expect(restored.bleeding?.intensity).toBe(intensity);
      expect(restored.bleeding?.clots).toBe('small');
    }
  );

  it('period_start entry with symptoms roundtrips correctly', () => {
    const entry: LogEntry = {
      event: 'period_start',
      date: '2026-04-14',
      ts: 1744584000000,
      isPeriod: true,
      isStart: true,
      isEnd: false,
      note: 'First day, mild cramps',
      bleeding: { intensity: 'medium' },
      symptoms: ['cramps', 'mood_low', 'trigger_stress'],
    };

    const restored: LogEntry = JSON.parse(JSON.stringify(entry));

    expect(restored.event).toBe('period_start');
    expect(restored.isStart).toBe(true);
    expect(restored.note).toBe('First day, mild cramps');
    expect(restored.symptoms).toEqual(['cramps', 'mood_low', 'trigger_stress']);
    expect(restored.bleeding?.intensity).toBe('medium');
  });
});
