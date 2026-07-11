import type { BleedingIntensity, SymptomKey, TemperatureUnit } from '../models/LogEntry';

/**
 * The set of LogScreen fields whose unsaved changes trigger the SaveReminder.
 *
 * A single normalized snapshot shape is used for BOTH the initial (from
 * `initialData`) and the current (from live state) capture, so the dirty check
 * is a deep-equality comparison of two identically-shaped objects. Adding a new
 * tracked field (e.g. T4's temperature) is a one-list change: add it to the
 * `LogSnapshot` type and to `snapshotFields()` — the comparator picks it up
 * automatically.
 */
export interface LogSnapshot {
  isStart: boolean;
  isEnd: boolean;
  bleeding: BleedingIntensity | null;
  clots: 'small' | 'large' | null;
  /** Sorted for order-independent comparison. */
  symptoms: SymptomKey[];
  note: string;
  temperature: { value: number; unit: TemperatureUnit } | null;
}

export interface LogFieldInput {
  isStart?: boolean;
  isEnd?: boolean;
  bleeding?: BleedingIntensity | null;
  clots?: 'small' | 'large' | null;
  symptoms?: Iterable<SymptomKey> | null;
  note?: string | null;
  temperature?: { value: number; unit: TemperatureUnit } | null;
}

/**
 * Build a normalized snapshot of the tracked LogScreen fields. Normalization
 * (default values, sorted symptoms, trimmed note) guarantees that the initial
 * and current snapshots are directly deep-comparable regardless of input shape
 * (a `Set` from live state vs. an array from `initialData`).
 */
export function snapshotFields(input: LogFieldInput | null | undefined): LogSnapshot {
  const symptoms = input?.symptoms ? Array.from(input.symptoms) : [];
  return {
    isStart: input?.isStart ?? false,
    isEnd: input?.isEnd ?? false,
    bleeding: input?.bleeding ?? null,
    clots: input?.clots ?? null,
    symptoms: symptoms.slice().sort(),
    note: (input?.note ?? '').trim(),
    temperature: input?.temperature
      ? { value: input.temperature.value, unit: input.temperature.unit }
      : null,
  };
}

/** Deep-equality of two normalized snapshots. */
export function snapshotsEqual(a: LogSnapshot, b: LogSnapshot): boolean {
  if (
    a.isStart !== b.isStart ||
    a.isEnd !== b.isEnd ||
    a.bleeding !== b.bleeding ||
    a.clots !== b.clots ||
    a.note !== b.note
  ) {
    return false;
  }
  if ((a.temperature === null) !== (b.temperature === null)) return false;
  if (
    a.temperature !== null &&
    b.temperature !== null &&
    (a.temperature.value !== b.temperature.value || a.temperature.unit !== b.temperature.unit)
  ) {
    return false;
  }
  if (a.symptoms.length !== b.symptoms.length) return false;
  for (let i = 0; i < a.symptoms.length; i++) {
    if (a.symptoms[i] !== b.symptoms[i]) return false;
  }
  return true;
}

/** True when the current fields differ from the initial fields (unsaved changes). */
export function isLogDirty(initial: LogFieldInput | null | undefined, current: LogFieldInput): boolean {
  return !snapshotsEqual(snapshotFields(initial), snapshotFields(current));
}
