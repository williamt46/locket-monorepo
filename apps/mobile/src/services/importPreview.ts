/**
 * importPreview — the PURE preview-build and commit-selection logic shared by
 * the file and HealthKit import paths.
 *
 * Extracted out of the `useLedger` hook so it is directly unit-testable without
 * a React renderer (the repo has no hook-rendering infra). The hook is the thin
 * glue: it decrypts the existing ledger once, calls `buildDateIndex` +
 * `buildImportPreview`, then `selectEntriesToInscribe` at commit.
 *
 * §14 guarantees enforced here:
 *  - collision default is 'keep-existing' (safe: incoming row is SKIPPED);
 *  - commit selects every non-collision row + every 'import-anyway' row, nothing
 *    else — no existing record is ever modified or deleted.
 */
import type { LogEntry } from '../models/LogEntry';
import type { ImportPreview, ImportPreviewRow, ImportSource } from '../models/ImportTypes';
import { toLocalIsoDate } from './ImportService';

/** The ISO YYYY-MM-DD day key for a LogEntry (prefers `.date`, falls back to ts). */
export function dateKeyOf(entry: LogEntry): string {
    return entry.date || toLocalIsoDate(entry.ts);
}

/**
 * Index decrypted existing entries by day. Last-writer-wins is irrelevant to
 * collision DETECTION (we only need "is there an entry that day"); the stored
 * value is shown to the user, so the most recent one for a day is kept.
 */
export function buildDateIndex(existing: LogEntry[]): Map<string, LogEntry> {
    const index = new Map<string, LogEntry>();
    for (const entry of existing) {
        index.set(dateKeyOf(entry), entry);
    }
    return index;
}

export interface BuildPreviewParams {
    source: ImportSource;
    /** Incoming, fully-mapped entries. Sorted ts-ascending here defensively. */
    logEntries: LogEntry[];
    existingByDate: Map<string, LogEntry>;
    permissionState: 'available' | 'ambiguous-zero';
    truncation: { earliestAuthorized: string } | null;
}

/** Assemble the §14 ImportPreview. Rows are ts-ascending; collisions default safe. */
export function buildImportPreview(params: BuildPreviewParams): ImportPreview {
    const { source, existingByDate, permissionState, truncation } = params;
    const sorted = [...params.logEntries].sort((a, b) => a.ts - b.ts);

    const rows: ImportPreviewRow[] = sorted.map((entry) => {
        const date = dateKeyOf(entry);
        const existing = existingByDate.get(date);
        return {
            date,
            entry,
            glyphs: {
                bleeding: !!entry.bleeding,
                temperature: !!entry.temperature,
                symptoms: !!(entry.symptoms && entry.symptoms.length > 0),
                note: !!entry.note,
            },
            collision: existing ? { existing, resolution: 'keep-existing' } : null,
        };
    });

    const collisions = rows.reduce((n, r) => (r.collision ? n + 1 : n), 0);
    const range = rows.length === 0
        ? null
        : { earliest: rows[0].date, latest: rows[rows.length - 1].date };

    return {
        source,
        rows,
        range,
        truncation,
        permissionState,
        counts: { total: rows.length, collisions },
    };
}

/**
 * Commit selection (§14 guarantee 2): every non-collision row + every collision
 * row resolved to 'import-anyway'. `skippedCount` is the collision rows left at
 * 'keep-existing'. Nothing else is touched.
 */
export function selectEntriesToInscribe(
    preview: ImportPreview,
): { toInscribe: LogEntry[]; skippedCount: number } {
    const toInscribe: LogEntry[] = [];
    let skippedCount = 0;
    for (const row of preview.rows) {
        if (!row.collision) {
            toInscribe.push(row.entry);
        } else if (row.collision.resolution === 'import-anyway') {
            toInscribe.push(row.entry);
        } else {
            skippedCount++; // 'keep-existing' → skip the incoming row
        }
    }
    return { toInscribe, skippedCount };
}
