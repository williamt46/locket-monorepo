export type ImportSource = 'clue' | 'flo' | 'csv' | 'healthkit' | 'unknown';

export interface LedgerEntry {
    ts: number;          // UTC epoch ms
    isPeriod: boolean;
    isStart?: boolean;
    isEnd?: boolean;
    flow?: number;       // 0=spotting, 1=light, 2=medium, 3=heavy
    note?: string;
    bbt?: number;
    source?: ImportSource;   // provenance tag
    unmapped?: Record<string, unknown>;  // defensive: preserve unknown keys
}

export interface ClueDay {
    day: string;  // ISO date "YYYY-MM-DD"
    [key: string]: unknown;  // polymorphic keys
}

export interface ClueExport {
    data: ClueDay[];
}

/**
 * The 2026 Clue export (`measurements.json`) is a top-level ARRAY of measurement
 * records rather than the legacy `{ data: [...] }` envelope.
 *
 * `value` is polymorphic by type — an object for single-valued types
 * (`period`, `bbt`, `birth_control_pill`) and an ARRAY of `{option}` for
 * multi-valued ones (`pain`, `energy`, `spotting`). Verified against a real
 * export 2026-07-22.
 */
export interface ClueMeasurement {
    type: string;
    date: string;   // "YYYY-MM-DD"
    id?: string;
    value?: unknown;
}

export type ClueMeasurementsExport = ClueMeasurement[];

export interface FloCycle {
    period_start_date: string;  // ISO date
    period_end_date: string;    // ISO date
    [key: string]: unknown;
}

/**
 * One logged event in a Flo point-event container.
 *
 * `properties` is deliberately `unknown`: `point_events_manual_v2` supplies a
 * real object (`{value: 36.4}`), while `repeatable_child_point_events` supplies
 * a JSON *string* (`"{\"missed_pill\": false}"`). Verified against a real export
 * 2026-07-23.
 */
export interface FloPointEvent {
    category?: string;
    subcategory?: string | null;
    properties?: unknown;
    date?: string;
    /** The user's local day; preferred over `date` when present. */
    local_date?: string;
    deleted?: boolean;
    /** Present on `notes` records only. */
    text?: string;
    [key: string]: unknown;
}

/**
 * Flo splits user data across FOUR containers. A parser that reads only
 * `cycles` silently drops medication logs, symptoms, BBT and free text — see
 * `parseFloExport`.
 */
export interface FloExport {
    operationalData: {
        cycles: FloCycle[];
        /** Recurring logs, e.g. Medication/Pills. */
        repeatable_child_point_events?: FloPointEvent[];
        /** One-off logs: Symptom, Mood, Temperature, Weight, Water… */
        point_events_manual_v2?: FloPointEvent[];
        /** Free-text notes, carried in `text`. */
        notes?: FloPointEvent[];
        [key: string]: unknown;
    };
}

export interface ImportStats {
    totalDays: number;
    periodDays: number;
    spottingDays: number;
    /**
     * Mixed unit by design: cycle-shaped input counts skipped DAYS, while
     * record-shaped input (Clue measurements, Flo point events) counts skipped
     * RECORDS. Treat it as a "how much didn't make it" signal rather than an
     * exact day count — every skip also emits a `warning`, which is what the
     * import UI actually surfaces.
     */
    skippedDays: number;
    latestTs?: number;
}

export interface ImportResult {
    source: ImportSource;
    entries: LedgerEntry[];
    warnings: string[];  // e.g. "3 days had unmapped keys", "ambiguous date format"
    stats: ImportStats;
}
