import { describe, it, expect } from 'vitest';
import type { LogEntry, BleedingIntensity, SymptomKey } from '../../src/models/LogEntry';

describe('LogEntry model', () => {
  it('constructs a minimal valid LogEntry (period_start)', () => {
    const entry: LogEntry = {
      event: 'period_start',
      date: '2026-04-01',
      ts: new Date('2026-04-01').getTime(),
    };
    expect(entry.event).toBe('period_start');
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof entry.ts).toBe('number');
  });

  it('roundtrips through JSON serialization without data loss', () => {
    const original: LogEntry = {
      event: 'manual_entry',
      date: '2026-04-03',
      ts: 1743638400000,
      isPeriod: false,
      isStart: false,
      isEnd: false,
      note: 'Feeling tired',
      bleeding: { intensity: 'light', clots: 'small' },
      symptoms: ['cramps', 'bloating', 'headache'],
    };

    const json = JSON.stringify(original);
    const restored: LogEntry = JSON.parse(json);

    expect(restored.event).toBe(original.event);
    expect(restored.date).toBe(original.date);
    expect(restored.ts).toBe(original.ts);
    expect(restored.note).toBe(original.note);
    expect(restored.bleeding?.intensity).toBe('light');
    expect(restored.bleeding?.clots).toBe('small');
    expect(restored.symptoms).toEqual(['cramps', 'bloating', 'headache']);
  });

  it('allows optional fields to be absent (backward compat with pre-Euki entries)', () => {
    // Legacy entries from before the Euki Education Layer had no bleeding/symptoms fields
    const legacy: LogEntry = {
      event: 'period_start',
      date: '2025-11-01',
      ts: new Date('2025-11-01').getTime(),
      isPeriod: true,
      isStart: true,
    };

    expect(legacy.bleeding).toBeUndefined();
    expect(legacy.symptoms).toBeUndefined();
    expect(legacy.note).toBeUndefined();
    expect(legacy.isEnd).toBeUndefined();
  });

  it('accepts all valid BleedingIntensity values', () => {
    const intensities: BleedingIntensity[] = ['spotting', 'light', 'medium', 'heavy'];
    for (const intensity of intensities) {
      const entry: LogEntry = {
        event: 'manual_entry',
        date: '2026-04-01',
        ts: Date.now(),
        bleeding: { intensity },
      };
      expect(entry.bleeding?.intensity).toBe(intensity);
    }
  });

  it('accepts all valid SymptomKey values', () => {
    const symptoms: SymptomKey[] = [
      'cramps',
      'bloating',
      'nausea_fatigue',
      'mood_low',
      'mood_anxious',
      'mood_irritable',
      'acne',
      'headache',
      'back_pain',
    ];
    const entry: LogEntry = {
      event: 'manual_entry',
      date: '2026-04-01',
      ts: Date.now(),
      symptoms,
    };
    expect(entry.symptoms?.length).toBe(9);
  });

  it('ts field is a number (Unix ms)', () => {
    const entry: LogEntry = {
      event: 'period_end',
      date: '2026-04-05',
      ts: 1743897600000,
    };
    expect(entry.ts).toBeGreaterThan(0);
    expect(Number.isInteger(entry.ts)).toBe(true);
  });
});
