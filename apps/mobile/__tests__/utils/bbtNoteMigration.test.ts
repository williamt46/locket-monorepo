import { describe, it, expect } from 'vitest';
import type { LogEntry } from '../../src/models/LogEntry';
import {
  noteHasBbt,
  parseBbtFromNote,
  migrateBbtInNote,
} from '../../src/utils/bbtNoteMigration';
import { ledgerEntryToLogEntry } from '../../src/services/ImportService';

const baseEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  event: 'manual_entry',
  date: '2026-07-11',
  ts: 1_752_000_000_000,
  isPeriod: false,
  ...overrides,
});

describe('noteHasBbt', () => {
  it('detects a BBT token regardless of case', () => {
    expect(noteHasBbt('period cramps. BBT: 36.5')).toBe(true);
    expect(noteHasBbt('bbt: 98.6')).toBe(true);
  });

  it('is false for absent/empty notes', () => {
    expect(noteHasBbt(undefined)).toBe(false);
    expect(noteHasBbt(null)).toBe(false);
    expect(noteHasBbt('')).toBe(false);
    expect(noteHasBbt('just a normal note')).toBe(false);
  });
});

describe('parseBbtFromNote', () => {
  it('extracts value and leaves a sentence-ending period intact (plan test)', () => {
    expect(parseBbtFromNote('period cramps. BBT: 36.5')).toEqual({
      value: 36.5,
      rest: 'period cramps.',
    });
  });

  it('strips a legacy ", " join separator (pre-T4 notes.join)', () => {
    expect(parseBbtFromNote('period cramps, BBT: 36.5')).toEqual({
      value: 36.5,
      rest: 'period cramps',
    });
  });

  it('returns empty rest when the note was BBT-only', () => {
    expect(parseBbtFromNote('BBT: 98.6')).toEqual({ value: 98.6, rest: '' });
  });

  it('handles a BBT token at the front', () => {
    expect(parseBbtFromNote('BBT: 36.4, cramps')).toEqual({
      value: 36.4,
      rest: 'cramps',
    });
  });

  it('parses integer and negative-safe numeric forms', () => {
    expect(parseBbtFromNote('BBT: 99')).toEqual({ value: 99, rest: '' });
  });

  it('returns null when no token is present', () => {
    expect(parseBbtFromNote('period cramps.')).toBeNull();
    expect(parseBbtFromNote('')).toBeNull();
  });
});

describe('migrateBbtInNote', () => {
  it('extracts temperature (°C inference) and strips the note (plan test)', () => {
    const result = migrateBbtInNote(baseEntry({ note: 'period cramps. BBT: 36.5' }));
    expect(result).not.toBeNull();
    expect(result!.temperature).toEqual({ value: 36.5, unit: 'C' });
    expect(result!.note).toBe('period cramps.');
  });

  it('infers °F for magnitudes >= 50', () => {
    const result = migrateBbtInNote(baseEntry({ note: 'BBT: 98.6' }));
    expect(result!.temperature).toEqual({ value: 98.6, unit: 'F' });
    expect(result!.note).toBeUndefined();
  });

  it('is idempotent — a second pass returns null (no further change)', () => {
    const first = migrateBbtInNote(baseEntry({ note: 'period cramps. BBT: 36.5' }));
    const second = migrateBbtInNote(first!);
    expect(second).toBeNull();
  });

  it('returns null when there is nothing to migrate', () => {
    expect(migrateBbtInNote(baseEntry({ note: 'just cramps' }))).toBeNull();
    expect(migrateBbtInNote(baseEntry({}))).toBeNull();
  });

  it('does not mutate its input', () => {
    const input = baseEntry({ note: 'period cramps. BBT: 36.5' });
    const snapshot = JSON.stringify(input);
    migrateBbtInNote(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('preserves an already-set temperature and only strips the stray note', () => {
    const result = migrateBbtInNote(
      baseEntry({ note: 'cramps, BBT: 36.5', temperature: { value: 98.6, unit: 'F' } }),
    );
    expect(result!.temperature).toEqual({ value: 98.6, unit: 'F' });
    expect(result!.note).toBe('cramps');
  });
});

describe('ledgerEntryToLogEntry re-import dedup guard', () => {
  it('maps bbt to temperature and does not append BBT to the note', () => {
    const log = ledgerEntryToLogEntry({
      ts: 1_752_000_000_000,
      isPeriod: false,
      bbt: 36.5,
      note: 'period cramps.',
    } as any);
    expect(log.temperature).toEqual({ value: 36.5, unit: 'C' });
    expect(log.note).toBe('period cramps.');
    expect(log.note).not.toMatch(/BBT/i);
  });

  it('strips a duplicate BBT token from the source note (re-import after migration)', () => {
    // A source note that still carries the legacy "BBT:" text alongside the
    // numeric bbt field must not re-duplicate the value into the note.
    const log = ledgerEntryToLogEntry({
      ts: 1_752_000_000_000,
      isPeriod: false,
      bbt: 36.5,
      note: 'period cramps. BBT: 36.5',
    } as any);
    expect(log.temperature).toEqual({ value: 36.5, unit: 'C' });
    expect(log.note).toBe('period cramps.');
    expect(log.note).not.toMatch(/BBT/i);
  });

  it('drops the note entirely when it was BBT-only', () => {
    const log = ledgerEntryToLogEntry({
      ts: 1_752_000_000_000,
      isPeriod: false,
      bbt: 98.6,
      note: 'BBT: 98.6',
    } as any);
    expect(log.temperature).toEqual({ value: 98.6, unit: 'F' });
    expect(log.note).toBeUndefined();
  });

  it('leaves a note without a BBT token unchanged', () => {
    const log = ledgerEntryToLogEntry({
      ts: 1_752_000_000_000,
      isPeriod: false,
      bbt: 36.5,
      note: 'heavy day',
    } as any);
    expect(log.note).toBe('heavy day');
    expect(log.temperature).toEqual({ value: 36.5, unit: 'C' });
  });
});
