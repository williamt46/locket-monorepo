import { describe, it, expect } from 'vitest';
import { snapshotFields, snapshotsEqual, isLogDirty } from '../../src/utils/logDirty';

describe('snapshotFields', () => {
  it('normalizes an empty/undefined input to defaults', () => {
    expect(snapshotFields(undefined)).toEqual({
      isStart: false,
      isEnd: false,
      bleeding: null,
      clots: null,
      symptoms: [],
      note: '',
      temperature: null,
    });
    expect(snapshotFields(null)).toEqual(snapshotFields({}));
  });

  it('sorts symptoms so order does not matter', () => {
    const a = snapshotFields({ symptoms: ['cramps', 'acne', 'bloating'] });
    const b = snapshotFields({ symptoms: ['bloating', 'cramps', 'acne'] });
    expect(a.symptoms).toEqual(['acne', 'bloating', 'cramps']);
    expect(a).toEqual(b);
  });

  it('accepts a Set for symptoms (live state shape)', () => {
    const s = snapshotFields({ symptoms: new Set(['headache', 'cramps'] as const) });
    expect(s.symptoms).toEqual(['cramps', 'headache']);
  });

  it('trims the note', () => {
    expect(snapshotFields({ note: '  hi  ' }).note).toBe('hi');
    expect(snapshotFields({ note: '   ' }).note).toBe('');
  });

  it('does not mutate the input symptoms array', () => {
    const input = ['cramps', 'acne'] as const;
    const copy = [...input];
    snapshotFields({ symptoms: input as any });
    expect(input).toEqual(copy);
  });
});

describe('snapshotsEqual', () => {
  it('is true for two equivalent snapshots', () => {
    expect(
      snapshotsEqual(
        snapshotFields({ isStart: true, symptoms: ['a', 'b'] as any, note: 'x ' }),
        snapshotFields({ isStart: true, symptoms: ['b', 'a'] as any, note: ' x' })
      )
    ).toBe(true);
  });

  it('detects a difference in every field', () => {
    const base = snapshotFields({});
    expect(snapshotsEqual(base, snapshotFields({ isStart: true }))).toBe(false);
    expect(snapshotsEqual(base, snapshotFields({ isEnd: true }))).toBe(false);
    expect(snapshotsEqual(base, snapshotFields({ bleeding: 'light' }))).toBe(false);
    expect(snapshotsEqual(base, snapshotFields({ clots: 'small' }))).toBe(false);
    expect(snapshotsEqual(base, snapshotFields({ note: 'hi' }))).toBe(false);
    expect(snapshotsEqual(base, snapshotFields({ symptoms: ['cramps'] as any }))).toBe(false);
  });

  it('distinguishes symptom sets of the same length', () => {
    expect(
      snapshotsEqual(
        snapshotFields({ symptoms: ['cramps'] as any }),
        snapshotFields({ symptoms: ['acne'] as any })
      )
    ).toBe(false);
  });
});

describe('isLogDirty', () => {
  it('is false when nothing changed', () => {
    const initial = {
      isStart: false,
      isEnd: false,
      bleeding: null,
      clots: null,
      symptoms: ['cramps'],
      note: 'note',
    };
    const current = {
      isStart: false,
      isEnd: false,
      bleeding: null,
      clots: null,
      symptoms: new Set(['cramps'] as const),
      note: 'note',
    };
    expect(isLogDirty(initial as any, current as any)).toBe(false);
  });

  it('is false for a fresh untouched screen (both empty)', () => {
    expect(isLogDirty(undefined, { isStart: false, isEnd: false, note: '', symptoms: new Set() })).toBe(false);
  });

  it('is true when a symptom is added', () => {
    expect(
      isLogDirty({ symptoms: ['cramps'] }, { symptoms: new Set(['cramps', 'acne'] as const) })
    ).toBe(true);
  });

  it('is true when a period boundary is toggled', () => {
    expect(isLogDirty({ isStart: false }, { isStart: true })).toBe(true);
  });

  it('is true when only whitespace-significant note content changes', () => {
    expect(isLogDirty({ note: 'a' }, { note: 'a  extra' })).toBe(true);
  });

  it('treats a note that only gained trailing whitespace as clean', () => {
    expect(isLogDirty({ note: 'a' }, { note: 'a  ' })).toBe(false);
  });

  it('is true when a temperature is added', () => {
    expect(isLogDirty({ temperature: null }, { temperature: { value: 98.6, unit: 'F' } })).toBe(true);
  });

  it('is true when a temperature is cleared', () => {
    expect(isLogDirty({ temperature: { value: 98.6, unit: 'F' } }, { temperature: null })).toBe(true);
  });

  it('is true when the temperature value changes', () => {
    expect(
      isLogDirty({ temperature: { value: 98.6, unit: 'F' } }, { temperature: { value: 98.7, unit: 'F' } })
    ).toBe(true);
  });

  it('is true when only the temperature unit changes', () => {
    expect(
      isLogDirty({ temperature: { value: 37, unit: 'C' } }, { temperature: { value: 37, unit: 'F' } })
    ).toBe(true);
  });

  it('is false when the temperature is identical', () => {
    expect(
      isLogDirty({ temperature: { value: 98.6, unit: 'F' } }, { temperature: { value: 98.6, unit: 'F' } })
    ).toBe(false);
  });
});
