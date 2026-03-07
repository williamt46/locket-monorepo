export type ImportSource = 'clue' | 'flo' | 'csv' | 'unknown';

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

export interface FloCycle {
    period_start_date: string;  // ISO date
    period_end_date: string;    // ISO date
    [key: string]: unknown;
}

export interface FloExport {
    operationalData: {
        cycles: FloCycle[];
    };
}

export interface ImportStats {
    totalDays: number;
    periodDays: number;
    spottingDays: number;
    skippedDays: number;
    latestTs?: number;
}

export interface ImportResult {
    source: ImportSource;
    entries: LedgerEntry[];
    warnings: string[];  // e.g. "3 days had unmapped keys", "ambiguous date format"
    stats: ImportStats;
}
