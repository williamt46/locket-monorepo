import {
    LedgerEntry,
    ImportResult,
    ImportSource,
    ClueExport,
    FloExport,
    ImportStats
} from '../models/ImportTypes';
import { LogEntry, BleedingIntensity } from '../models/LogEntry';
import { inferTemperatureUnit } from '../utils/temperature';
import { parseBbtFromNote } from '../utils/bbtNoteMigration';

// --- Type Guards and Detectors ---

export function detectFormat(raw: string): 'json' | 'csv' | 'unknown' {
    if (!raw || typeof raw !== 'string') return 'unknown';

    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            JSON.parse(trimmed);
            return 'json';
        } catch {
            return 'unknown';
        }
    }

    // Naive CSV detection: contains newlines and commas
    if (trimmed.includes('\n') && trimmed.includes(',')) {
        return 'csv';
    }

    return 'unknown';
}

export function detectSource(json: unknown): ImportSource {
    if (!json || typeof json !== 'object') return 'unknown';

    // Clue signature: root has "data" array
    if ('data' in json && Array.isArray((json as any).data)) {
        return 'clue';
    }

    // Flo signature: root has "operationalData.cycles" array
    if (
        'operationalData' in json &&
        typeof (json as any).operationalData === 'object' &&
        'cycles' in (json as any).operationalData &&
        Array.isArray((json as any).operationalData.cycles)
    ) {
        return 'flo';
    }

    return 'unknown';
}

// --- Clue Parser ---

export function parseClueExport(json: ClueExport): ImportResult {
    const entries: LedgerEntry[] = [];
    const warnings: string[] = [];
    const stats: ImportStats = { totalDays: 0, periodDays: 0, spottingDays: 0, skippedDays: 0 };

    if (!json || !Array.isArray(json.data)) {
        throw new Error('Invalid Clue export format: missing data array');
    }

    // 1. First pass: parse days
    for (const day of json.data) {
        if (!day.day || typeof day.day !== 'string') {
            stats.skippedDays++;
            continue;
        }

        stats.totalDays++;

        // "YYYY-MM-DD"
        const [y, m, d] = day.day.split('-').map(Number);

        // Treat missing/malformed dates as skips
        if (!y || !m || !d) {
            stats.skippedDays++;
            continue;
        }
        // Local midnight for alignment with device UI
        const ts = new Date(y, m - 1, d).getTime();

        const unmapped: Record<string, unknown> = {};
        const entry: LedgerEntry = { ts, isPeriod: false, source: 'clue' };

        const symptoms: string[] = [];

        // Process keys
        for (const [key, value] of Object.entries(day)) {
            if (key === 'day') continue;

            if (key === 'spotting') {
                entry.isPeriod = false;
                entry.flow = 0; // spotting
                stats.spottingDays++;
            } else if (key.startsWith('period/')) {
                entry.isPeriod = true;
                stats.periodDays++;

                if (key === 'period/light') entry.flow = 1;
                else if (key === 'period/medium') entry.flow = 2;
                else if (key === 'period/heavy' || key === 'period/very_heavy') entry.flow = 3;
            } else if (key === 'bbt' && typeof value === 'number') {
                entry.bbt = value;
            } else if (value === true) {
                const words = key.split(/[/_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
                symptoms.push(words.join(': '));
            } else {
                const words = key.split(/[/_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
                const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                symptoms.push(`${words.join(': ')}: ${valStr}`);
            }
        }

        if (symptoms.length > 0) {
            entry.note = symptoms.join(', ');
        }

        entries.push(entry);
    }

    // Sort chronologically just in case
    entries.sort((a, b) => a.ts - b.ts);

    // 2. Second pass: mark starts and ends of period runs
    applyBoundaryFlags(entries);

    if (entries.length > 0) {
        stats.latestTs = Math.max(...entries.map(e => e.ts));
    }

    return { source: 'clue', entries, warnings, stats };
}

// --- Flo Parser ---

export function parseFloExport(json: FloExport): ImportResult {
    const entries: LedgerEntry[] = [];
    const warnings: string[] = [];
    const stats: ImportStats = { totalDays: 0, periodDays: 0, spottingDays: 0, skippedDays: 0 };

    if (!json || !json.operationalData || !Array.isArray(json.operationalData.cycles)) {
        throw new Error('Invalid Flo export format: missing cycles array');
    }

    // Sort cycles ascending
    const cycles = [...json.operationalData.cycles].sort((a, b) => {
        return new Date(a.period_start_date).getTime() - new Date(b.period_start_date).getTime();
    });

    for (const cycle of cycles) {
        if (!cycle.period_start_date || !cycle.period_end_date) {
            stats.skippedDays++;
            continue;
        }

        const [sy, sm, sd] = cycle.period_start_date.split('-').map(Number);
        const [ey, em, ed] = cycle.period_end_date.split('-').map(Number);

        if (!sy || !ey) {
            stats.skippedDays++;
            continue;
        }

        const startTs = new Date(sy, sm - 1, sd).getTime();
        const endTs = new Date(ey, em - 1, ed).getTime();

        // Calculate number of days (inclusive)
        const daysDiff = Math.round((endTs - startTs) / (1000 * 60 * 60 * 24)) + 1;

        if (daysDiff <= 0 || daysDiff > 30) {
            // Guard against bad dates or massive erroneous periods
            warnings.push(`Cycle starting ${cycle.period_start_date} is invalid or suspiciously long (${daysDiff} days).`);
            stats.skippedDays += Math.max(0, daysDiff);
            continue;
        }

        // Collect unmapped cycle-level properties
        const cycleNotes: string[] = [];
        for (const [key, value] of Object.entries(cycle)) {
            if (key !== 'period_start_date' && key !== 'period_end_date') {
                const words = key.split(/[/_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
                const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                cycleNotes.push(`${words.join(' ')}: ${valStr}`);
            }
        }

        // Generate an entry for each day
        for (let i = 0; i < daysDiff; i++) {
            const currentTs = startTs + (i * 24 * 60 * 60 * 1000);

            const entry: LedgerEntry = {
                ts: currentTs,
                isPeriod: true,
                flow: 2, // Default to medium for Flo as they don't export pure intensity in start/end
                source: 'flo'
            };

            const dayNotes = [...cycleNotes, `Flo Cycle Day: ${i + 1}`];
            entry.note = dayNotes.join(', ');

            stats.totalDays++;
            stats.periodDays++;
            entries.push(entry);
        }
    }

    // Clean up floats and deduplicate if overlapping cycles existed, then boundary flags
    const uniqueEntriesMap = new Map<number, LedgerEntry>();
    for (const e of entries) {
        uniqueEntriesMap.set(e.ts, e);
    }

    const finalEntries = Array.from(uniqueEntriesMap.values()).sort((a, b) => a.ts - b.ts);
    applyBoundaryFlags(finalEntries);

    if (finalEntries.length > 0) {
        stats.latestTs = Math.max(...finalEntries.map(e => e.ts));
    }

    return { source: 'flo', entries: finalEntries, warnings, stats };
}

// --- CSV Parser ---

function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function parseDateAutoDetect(dateStr: string, isUsFormatDefault = true): number | null {
    if (!dateStr) return null;

    // Attempt ISO (YYYY-MM-DD)
    const isoMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10);
        const d = parseInt(isoMatch[3], 10);
        return new Date(y, m - 1, d).getTime();
    }

    // Attempt US/EU (MM/DD/YYYY or DD/MM/YYYY)
    const slashesMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (slashesMatch) {
        const p1 = parseInt(slashesMatch[1], 10);
        const p2 = parseInt(slashesMatch[2], 10);
        const y = parseInt(slashesMatch[3], 10);

        if (p1 > 12) {
            // Definitely DD/MM/YYYY
            return new Date(y, p2 - 1, p1).getTime();
        } else if (p2 > 12) {
            // Definitely MM/DD/YYYY
            return new Date(y, p1 - 1, p2).getTime();
        } else {
            // Ambiguous format (e.g. 05/06/2024 -> May 6 or June 5?)
            if (isUsFormatDefault) {
                return new Date(y, p1 - 1, p2).getTime(); // Assume US: MM/DD
            } else {
                return new Date(y, p2 - 1, p1).getTime(); // Assume EU: DD/MM
            }
        }
    }

    return null; // Unrecognized format
}

export function parseCsvExport(csvString: string): ImportResult {
    const entries: LedgerEntry[] = [];
    const warnings: string[] = [];
    const stats: ImportStats = { totalDays: 0, periodDays: 0, spottingDays: 0, skippedDays: 0 };

    if (!csvString || typeof csvString !== 'string') {
        throw new Error('Invalid CSV input');
    }

    const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        throw new Error('CSV must contain a header row and data rows');
    }

    const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());

    // Identify columns
    const dateIdx = headers.findIndex(h => h === 'date' || h === 'day' || h === 'start_date' || h === 'start date');
    const flowIdx = headers.findIndex(h => h === 'flow' || h === 'bleeding' || h === 'period' || h === 'intensity');
    const bbtIdx = headers.findIndex(h => h === 'bbt' || h === 'temperature' || h === 'temp' || h === 'basal_body_temperature');
    const noteIdx = headers.findIndex(h => h === 'note' || h === 'notes' || h === 'comment' || h === 'comments');

    if (dateIdx === -1) {
        throw new Error('CSV must contain a date column (Date, Day, Start_Date)');
    }

    // Determine default date format from the first data row
    let isUsFormatDefault = true;
    if (lines.length > 1) {
        const firstDataRow = splitCsvLine(lines[1]);
        const dateStr = firstDataRow[dateIdx];
        if (dateStr) {
            const slashesMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
            if (slashesMatch) {
                const p1 = parseInt(slashesMatch[1], 10);
                const p2 = parseInt(slashesMatch[2], 10);
                if (p1 <= 12 && p2 <= 12) {
                    warnings.push('Ambiguous date format (e.g. 05/06/2024). Defaulting to US format (MM/DD/YYYY).');
                } else if (p1 > 12) {
                    isUsFormatDefault = false; // It's EU DD/MM
                }
            }
        }
    }

    for (let i = 1; i < lines.length; i++) {
        const rowData = splitCsvLine(lines[i]);
        if (rowData.length === 0 || (rowData.length === 1 && !rowData[0])) continue; // Skip truly empty rows

        const dateStr = rowData[dateIdx]?.trim();
        if (!dateStr) {
            stats.skippedDays++;
            continue;
        }

        const ts = parseDateAutoDetect(dateStr, isUsFormatDefault);
        if (ts === null || isNaN(ts)) {
            stats.skippedDays++;
            warnings.push(`Day ${dateStr} parsed to invalid timestamp, skipping.`);
            continue;
        }

        const extraNotes: string[] = [];
        let flowSet = false;
        let flowValRaw = '';

        let flowNum = 2; // Default to medium if just marked as period
        let isSpotting = false;

        // Parse Known Columns
        if (flowIdx !== -1) {
            flowValRaw = rowData[flowIdx]?.trim().toLowerCase() || '';
            if (flowValRaw) {
                flowSet = true;
                if (flowValRaw === 'spotting' || flowValRaw === '0') {
                    isSpotting = true;
                    flowNum = 0;
                    stats.spottingDays++;
                } else if (flowValRaw === 'light' || flowValRaw === '1') {
                    flowNum = 1;
                    stats.periodDays++;
                } else if (flowValRaw === 'heavy' || flowValRaw === 'very heavy' || flowValRaw === '3') {
                    flowNum = 3;
                    stats.periodDays++;
                } else if (flowValRaw === 'medium' || flowValRaw === '2') {
                    flowNum = 2;
                    stats.periodDays++;
                } else if (flowValRaw === 'yes' || flowValRaw === 'true' || flowValRaw === '1') {
                    // Just marked as having period
                    flowNum = 2;
                    stats.periodDays++;
                } else {
                    // If it has *some* value but not recognized, assume period and put raw value in unmapped
                    flowNum = 2;
                    stats.periodDays++;
                    extraNotes.push(`Raw Flow: ${flowValRaw}`);
                }
            }
        }

        // Only skip row if no flow info and no other info
        if (!flowSet && Object.keys(rowData).length <= 1) {
            stats.skippedDays++;
            continue;
        }

        const entry: LedgerEntry = {
            ts,
            isPeriod: flowSet && !isSpotting,
            source: 'csv'
        };

        if (flowSet) {
            entry.flow = flowNum;
        }

        if (bbtIdx !== -1) {
            const bbtVal = rowData[bbtIdx]?.trim();
            if (bbtVal && !isNaN(parseFloat(bbtVal))) {
                entry.bbt = parseFloat(bbtVal);
            }
        }

        if (noteIdx !== -1) {
            const noteVal = rowData[noteIdx]?.trim();
            if (noteVal) {
                // Ensure primary note is at the front
                extraNotes.unshift(noteVal);
            }
        }

        // Collect Unmapped Columns
        for (let colIdx = 0; colIdx < headers.length; colIdx++) {
            if (colIdx === dateIdx || colIdx === flowIdx || colIdx === bbtIdx || colIdx === noteIdx) continue;

            const head = headers[colIdx];
            const val = rowData[colIdx]?.trim();
            if (head && val) {
                const words = head.split(/[/_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
                extraNotes.push(`${words.join(' ')}: ${val}`);
            }
        }

        if (extraNotes.length > 0) {
            entry.note = extraNotes.join(', ');
        }

        // We ensure we only add entries that have actual data, not just an empty date
        if (flowSet || entry.bbt !== undefined || entry.note) {
            stats.totalDays++;
            entries.push(entry);
        } else {
            stats.skippedDays++;
        }
    }

    entries.sort((a, b) => a.ts - b.ts);
    applyBoundaryFlags(entries);

    if (entries.length > 0) {
        stats.latestTs = Math.max(...entries.map(e => e.ts));
    }

    return { source: 'csv', entries, warnings, stats };
}

// --- Helpers ---

/**
 * Modifies the array in-place, adding isStart/isEnd flags
 * to consecutive runs of isPeriod === true days.
 */
function applyBoundaryFlags(entries: LedgerEntry[]) {
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        // Remove old tags just to be safe
        delete entry.isStart;
        delete entry.isEnd;

        if (!entry.isPeriod) continue;

        const prev = i > 0 ? entries[i - 1] : null;
        const next = i < entries.length - 1 ? entries[i + 1] : null;

        // Is it a start? (Previous is missing, or not a period, or more than 1 day ago)
        if (!prev || !prev.isPeriod || entry.ts - prev.ts > (24 * 60 * 60 * 1000 * 1.5)) {
            entry.isStart = true;
        }

        // Is it an end? (Next is missing, or not a period, or more than 1 day in future)
        if (!next || !next.isPeriod || next.ts - entry.ts > (24 * 60 * 60 * 1000 * 1.5)) {
            entry.isEnd = true;
        }
    }
}

// --- App-domain mapping ---

// flow intensity (import domain) -> bleeding intensity (LogScreen modal / calendar)
const FLOW_TO_INTENSITY: Record<number, BleedingIntensity> = {
    0: 'spotting',
    1: 'light',
    2: 'medium',
    3: 'heavy',
};

function toLocalIsoDate(ts: number): string {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Convert an import-domain LedgerEntry into the app-domain LogEntry that the
 * LogScreen modal and MonthGrid actually read.
 *
 * Imported entries used to be inscribed in raw LedgerEntry shape (numeric `flow`,
 * numeric `bbt`), but the UI reads `bleeding.intensity` and has no bbt field — so
 * after import, spotting/flow never appeared on the Log modal and BBT was dropped.
 *
 *   flow (0..3) -> bleeding.intensity (spotting / light / medium / heavy)
 *   bbt         -> temperature { value, unit }, written directly to the dedicated
 *                  field (no longer stuffed into the free-text note). Source
 *                  formats don't tag the unit, so it's inferred by magnitude
 *                  (>= 50 -> °F, else °C) since valid °F/°C ranges don't overlap.
 */
export function ledgerEntryToLogEntry(entry: LedgerEntry): LogEntry {
    const hasBbt = typeof entry.bbt === 'number' && !Number.isNaN(entry.bbt);

    // Re-import dedup guard: BBT now lives in the dedicated `temperature` field.
    // If the source note already carries a legacy `"BBT: {value}"` token (e.g.
    // re-importing a file whose note text was written by the pre-T4 importer, or
    // that the T9 migration has since moved into `temperature`), strip it so the
    // value isn't duplicated across the note string and the temperature field.
    const notes: string[] = [];
    if (entry.note) {
        const cleaned = hasBbt ? (parseBbtFromNote(entry.note)?.rest ?? entry.note) : entry.note;
        if (cleaned) notes.push(cleaned);
    }

    const log: LogEntry = {
        event: entry.isStart ? 'period_start' : entry.isEnd ? 'period_end' : 'manual_entry',
        date: toLocalIsoDate(entry.ts),
        ts: entry.ts,
        isPeriod: entry.isPeriod,
    };

    if (entry.isStart) log.isStart = true;
    if (entry.isEnd) log.isEnd = true;
    if (notes.length > 0) log.note = notes.join(', ');

    const intensity = typeof entry.flow === 'number' ? FLOW_TO_INTENSITY[entry.flow] : undefined;
    if (intensity) log.bleeding = { intensity };

    if (hasBbt) {
        log.temperature = { value: entry.bbt as number, unit: inferTemperatureUnit(entry.bbt as number) };
    }

    return log;
}
