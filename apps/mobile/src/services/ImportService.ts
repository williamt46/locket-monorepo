import {
    LedgerEntry,
    ImportResult,
    ImportSource,
    ClueExport,
    ClueMeasurement,
    FloExport,
    FloPointEvent,
    ImportStats
} from '../models/ImportTypes';
import { LogEntry, BleedingIntensity } from '../models/LogEntry';
import { inferTemperatureUnit } from '../utils/temperature';
import { parseBbtFromNote } from '../utils/bbtNoteMigration';
import { extractSymptomsFromNote } from '../utils/symptomTextMapping';

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

    // Clue 2026 signature: top-level ARRAY of {type, date, value} measurement
    // records. Probe a few elements rather than the whole array — the real export
    // is 100+ records and one malformed row shouldn't defeat detection.
    if (Array.isArray(json)) {
        const probe = json.slice(0, 5);
        const looksLikeMeasurements = probe.length > 0 && probe.every(
            r => r && typeof r === 'object'
                && typeof (r as any).type === 'string'
                && typeof (r as any).date === 'string'
        );
        return looksLikeMeasurements ? 'clue' : 'unknown';
    }

    // Clue legacy signature: root has "data" array
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

// --- Shared guards ---

/**
 * An entry that carries nothing is not worth inscribing.
 *
 * Container-shaped sources can produce a date with no usable payload (a note
 * record whose `text` is empty, an event with no category, a day whose only
 * reading was excluded). Those must not become blank ledger days.
 */
function hasImportableData(entry: LedgerEntry): boolean {
    return entry.isPeriod
        || typeof entry.flow === 'number'
        || typeof entry.bbt === 'number'
        || !!entry.note;
}

/**
 * Fail closed on a recognized-but-empty import.
 *
 * Lives here rather than inline in `useLedger` so it is unit-testable: this is
 * the guard that stops the UI reporting "Import Complete — Records Inscribed: 0"
 * for a file that parsed but mapped to nothing.
 */
export function assertImportHasEntries(result: ImportResult | null | undefined): asserts result is ImportResult {
    if (result && result.entries.length > 0) return;

    const detected = result?.source ? result.source.toUpperCase() : 'the file';
    // Cap the appended detail: a badly-formed file can produce a warning per
    // cycle, and the whole string ends up in an alert box.
    const warnings = result?.warnings ?? [];
    const shown = warnings.slice(0, 3).join('; ');
    const more = warnings.length > 3 ? ` (+${warnings.length - 3} more)` : '';
    const detail = shown ? ` Parser warnings: ${shown}${more}` : '';

    throw new Error(
        `Recognized as ${detected} but found 0 valid entries — check the file isn't empty or corrupted.${detail}`
    );
}

// --- Clue Parser (2026 measurements.json) ---

const CLUE_FLOW_BY_OPTION: Record<string, number> = {
    light: 1,
    medium: 2,
    heavy: 3,
    very_heavy: 3,
};

/**
 * Clue's `value` is polymorphic: `{option: "medium"}` for single-valued types,
 * `[{option: "period_cramps"}, ...]` for multi-valued ones. Normalize both to a
 * flat list of option strings so callers don't have to branch on shape — getting
 * this wrong silently drops every pain/energy/spotting symptom.
 */
function clueOptions(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .map(v => (v && typeof v === 'object' ? (v as any).option : v))
            .filter((o): o is string => typeof o === 'string');
    }
    if (value && typeof value === 'object' && typeof (value as any).option === 'string') {
        return [(value as any).option];
    }
    return [];
}

/**
 * "period_cramps" -> "Period Cramps".
 *
 * Space-joined, NOT the legacy `': '` join used for the old key-based format:
 * `extractSymptomsFromNote` matches whole comma-delimited tokens, so
 * "Breast Tenderness" lights up its pill while "Breast: Tenderness" would not.
 */
function titleCaseWords(raw: string): string {
    return raw
        .split(/[/_\s]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/**
 * Parse the 2026 Clue export: a flat array of `{type, date, value}` records,
 * grouped into one LedgerEntry per calendar date.
 *
 *   period.value.option light/medium/heavy -> flow 1/2/3, isPeriod true
 *   spotting                               -> flow 0 (when no period that day)
 *   bbt.value.celsius                      -> entry.bbt, unless value.excluded
 *   pain / energy / birth_control_pill     -> note text (pills where recognized)
 */
export function parseClueMeasurements(records: ClueMeasurement[]): ImportResult {
    const entries: LedgerEntry[] = [];
    const warnings: string[] = [];
    const stats: ImportStats = { totalDays: 0, periodDays: 0, spottingDays: 0, skippedDays: 0 };

    if (!Array.isArray(records)) {
        throw new Error('Invalid Clue export format: expected an array of measurement records');
    }

    // 1. Group records by calendar date
    const byDate = new Map<string, ClueMeasurement[]>();
    let undatedRecords = 0;
    for (const rec of records) {
        if (!rec || typeof rec !== 'object' || typeof rec.date !== 'string' || !rec.date.trim()) {
            // Never skip silently: skippedDays isn't surfaced in the import UI,
            // so a dropped record needs a warning to be visible at all.
            undatedRecords++;
            stats.skippedDays++;
            continue;
        }
        const dayPart = rec.date.trim().split(/[ T]/)[0];
        const bucket = byDate.get(dayPart);
        if (bucket) bucket.push(rec);
        else byDate.set(dayPart, [rec]);
    }

    // 2. One entry per date
    let excludedBbtCount = 0;

    for (const [date, recs] of byDate) {
        const [y, m, d] = date.split('-').map(Number);
        if (!y || !m || !d || !Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
            stats.skippedDays += recs.length;
            warnings.push(`Skipped ${recs.length} record(s) with unparseable date "${date}".`);
            continue;
        }

        // Local midnight for alignment with device UI
        const ts = new Date(y, m - 1, d).getTime();
        const entry: LedgerEntry = { ts, isPeriod: false, source: 'clue' };
        const notes: string[] = [];

        let sawPeriod = false;
        let sawSpotting = false;

        for (const rec of recs) {
            const type = typeof rec.type === 'string' ? rec.type : '';
            const options = clueOptions(rec.value);

            if (type === 'period') {
                sawPeriod = true;
                entry.isPeriod = true;
                const opt = options[0];
                const flow = opt ? CLUE_FLOW_BY_OPTION[opt] : undefined;
                if (flow === undefined) {
                    // Unrecognized intensity is still a period day — default to
                    // medium and preserve the raw option rather than dropping it.
                    entry.flow = 2;
                    notes.push(`Period ${titleCaseWords(opt || 'unknown')}`);
                } else {
                    entry.flow = flow;
                }
            } else if (type === 'spotting') {
                sawSpotting = true;
                for (const o of options) notes.push(`Spotting ${titleCaseWords(o)}`);
                if (options.length === 0) notes.push('Spotting');
            } else if (type === 'bbt') {
                const v = rec.value as any;
                if (v && typeof v === 'object' && typeof v.celsius === 'number' && Number.isFinite(v.celsius)) {
                    if (v.excluded === true) {
                        // Clue lets a user exclude an outlier reading from their
                        // own charting; importing it as real would corrupt BBT.
                        excludedBbtCount++;
                    } else {
                        entry.bbt = v.celsius;
                    }
                }
            } else if (type === 'birth_control_pill') {
                for (const o of options) notes.push(`Birth Control Pill: ${titleCaseWords(o)}`);
            } else if (options.length > 0) {
                // pain / energy / any future type — emit bare phrases so the
                // recognized ones ("Breast Tenderness") become symptom pills.
                for (const o of options) notes.push(titleCaseWords(o));
            } else if (type) {
                // A type whose `value` shape we don't understand yet. Record that
                // the user tracked SOMETHING that day rather than dropping it —
                // silently ignoring tracked data is the bug this parser exists to
                // fix, and an unknown shape is exactly where it would recur.
                const scalar = typeof rec.value === 'string' || typeof rec.value === 'number'
                    ? `: ${String(rec.value)}`
                    : '';
                notes.push(`${titleCaseWords(type)}${scalar}`);
            }
        }

        // Spotting is only a flow value when it isn't overridden by a real period
        if (sawSpotting && !sawPeriod) {
            entry.flow = 0;
        }

        if (notes.length > 0) entry.note = notes.join(', ');

        // A day whose only record was an excluded BBT carries nothing.
        if (!hasImportableData(entry)) continue;

        if (sawPeriod) stats.periodDays++;
        if (sawSpotting) stats.spottingDays++;
        stats.totalDays++;
        entries.push(entry);
    }

    if (undatedRecords > 0) {
        warnings.push(`${undatedRecords} record(s) had no usable date and were skipped.`);
    }

    if (excludedBbtCount > 0) {
        warnings.push(`${excludedBbtCount} BBT reading(s) were marked excluded in Clue and were not imported.`);
    }

    entries.sort((a, b) => a.ts - b.ts);
    applyBoundaryFlags(entries);

    if (entries.length > 0) {
        stats.latestTs = Math.max(...entries.map(e => e.ts));
    }

    return { source: 'clue', entries, warnings, stats };
}

// --- Clue Parser (legacy {data: [...]}) ---

export function parseClueExport(json: ClueExport): ImportResult {
    // The 2026 export is a bare array; dispatch so both shapes work through the
    // same entry point (useLedger and existing callers stay unchanged).
    if (Array.isArray(json)) {
        return parseClueMeasurements(json as unknown as ClueMeasurement[]);
    }

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

/**
 * Flo writes cycle dates as "YYYY-MM-DD 00:00:00.0" (real 2026 export), though
 * older/bare "YYYY-MM-DD" also occurs. Splitting the raw string on '-' leaves
 * "DD 00:00:00.0" as the day token, and Number("18 00:00:00.0") is NaN — which
 * then poisons every downstream date computation silently. Strip the time
 * component before splitting, and return null rather than a NaN timestamp so
 * callers are forced to handle the bad-date case explicitly.
 */
function parseFloDateToTs(dateStr: unknown): number | null {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const dayPart = dateStr.trim().split(/[ T]/)[0];
    const [y, m, d] = dayPart.split('-').map(Number);

    if (!y || !m || !d || !Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
        return null;
    }

    // Local midnight for alignment with device UI
    const ts = new Date(y, m - 1, d).getTime();
    return Number.isFinite(ts) ? ts : null;
}

/**
 * Cycle-level keys that are transport/bookkeeping metadata rather than anything
 * the user logged.
 *
 * This is a DENYLIST on purpose. An allowlist of known-good keys would silently
 * drop any key Flo adds later — and cycle objects really do carry user data
 * (the legacy fixture has `symptom_cramps` and `note` at cycle level), which is
 * exactly the "tracked data must never be silently ignored" rule. Everything not
 * listed here survives into note text.
 */
const FLO_CYCLE_METADATA_KEYS = new Set([
    'id', 'user_id', 'parent_id', 'source_id', 'source', 'source_client',
    'source_client_version', 'created_at', 'updated_at', 'deleted', 'time_index',
    'additional_fields', 'period_start_date', 'period_end_date', 'period_intensity',
]);

/**
 * cycles[].period_intensity is {"<cycle day>": <level>} — e.g. {"4": 1} meaning
 * day 4 of that cycle. Level 1 is corroborated as "Low" by the same export's
 * res.txt ("Day 4: intensity: Low"); 2 and 3 are assumed to continue the scale.
 * An unrecognized level keeps the default medium flow and is preserved in the
 * note rather than guessed at.
 */
const FLO_INTENSITY_TO_FLOW: Record<number, number> = { 1: 1, 2: 2, 3: 3 };

/**
 * Empty/absent values that would otherwise render as literal noise in a note
 * ("Pregnant Due Date: null", "Additional Fields: {}"). Flo's cycle keys are
 * flag- or level-shaped, so `false` and `0` mean "not present" and are dropped
 * too — `pregnant: false` is not a fact worth writing to a user's ledger.
 */
function isNoteworthyValue(value: unknown): boolean {
    if (value === null || value === undefined || value === false || value === 0) return false;
    if (typeof value === 'string') {
        const t = value.trim();
        return t !== '' && t !== '{}' && t !== 'null';
    }
    if (typeof value === 'object') return Object.keys(value as object).length > 0;
    return true;
}

/**
 * "2025-01-01 00:00:00.0" -> "2025-01-01".
 *
 * Flo stamps user-facing dates (e.g. `pregnant_start_date`) with a time
 * component. Those keys are user data, so they belong in the note — but writing
 * the raw stamp would put a precise timestamp in a user's ledger, which is the
 * same class of leak as the id/created_at dump this parser removed.
 */
function stripTimeComponent(value: string): string {
    const t = value.trim();
    return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(t) ? t.split(/[ T]/)[0] : value;
}

/** "TenderBreasts" -> "Tender Breasts", so it can match a symptom pill. */
function splitCamel(raw: string): string {
    return raw
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Flo stores some `properties` blobs as JSON strings and others as real objects. */
function floProperties(raw: unknown): Record<string, unknown> {
    if (!raw) return {};
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

/**
 * Parse a Flo export.
 *
 * Flo splits user data across FOUR containers under `operationalData`, and this
 * parser used to read only the first — so a real export imported period days but
 * silently dropped 31 contraceptive-pill logs, every symptom, both BBT readings,
 * and the free-text note:
 *
 *   cycles                        -> period day ranges (+ per-day intensity)
 *   repeatable_child_point_events -> recurring logs, e.g. Medication/Pills
 *   point_events_manual_v2        -> one-off logs: Symptom, Mood, Temperature, Weight…
 *   notes                         -> free text
 *
 * All four are merged by calendar date, so a day that appears in several
 * containers produces one entry carrying all of it.
 */
export function parseFloExport(json: FloExport): ImportResult {
    const warnings: string[] = [];
    const stats: ImportStats = { totalDays: 0, periodDays: 0, spottingDays: 0, skippedDays: 0 };

    if (!json || !json.operationalData || !Array.isArray(json.operationalData.cycles)) {
        throw new Error('Invalid Flo export format: missing cycles array');
    }

    const op = json.operationalData;

    // ts -> entry, with a parallel note accumulator so contributions from all
    // four containers merge onto the same day instead of overwriting each other.
    const byTs = new Map<number, LedgerEntry>();
    const notesByTs = new Map<number, string[]>();

    const entryFor = (ts: number): LedgerEntry => {
        let entry = byTs.get(ts);
        if (!entry) {
            entry = { ts, isPeriod: false, source: 'flo' };
            byTs.set(ts, entry);
            notesByTs.set(ts, []);
        }
        return entry;
    };

    const addNote = (ts: number, text: string) => {
        const list = notesByTs.get(ts);
        if (list && text && !list.includes(text)) list.push(text);
    };

    /** Shared date resolution: prefer the user's local date over the UTC stamp. */
    const tsOf = (rec: FloPointEvent): number | null => parseFloDateToTs(rec?.local_date ?? rec?.date);

    // Sort cycles ascending
    const cycles = [...json.operationalData.cycles].sort((a, b) => {
        return (parseFloDateToTs(a.period_start_date) ?? 0) - (parseFloDateToTs(b.period_start_date) ?? 0);
    });

    for (const cycle of cycles) {
        if (!cycle.period_start_date || !cycle.period_end_date) {
            stats.skippedDays++;
            continue;
        }

        const startTs = parseFloDateToTs(cycle.period_start_date);
        const endTs = parseFloDateToTs(cycle.period_end_date);

        if (startTs === null || endTs === null) {
            warnings.push(`Cycle starting ${cycle.period_start_date} has an unparseable date and was skipped.`);
            stats.skippedDays++;
            continue;
        }

        // Calculate number of days (inclusive)
        const daysDiff = Math.round((endTs - startTs) / (1000 * 60 * 60 * 24)) + 1;

        // NaN must fail closed: `NaN <= 0 || NaN > 30` is false, so a non-finite
        // daysDiff used to slip past this guard into `for (i = 0; i < NaN; i++)`,
        // which never iterates — producing zero entries with no warning at all.
        if (!Number.isFinite(daysDiff) || daysDiff <= 0 || daysDiff > 30) {
            // Guard against bad dates or massive erroneous periods
            warnings.push(`Cycle starting ${cycle.period_start_date} is invalid or suspiciously long (${daysDiff} days).`);
            stats.skippedDays += Number.isFinite(daysDiff) ? Math.max(0, daysDiff) : 1;
            continue;
        }

        // Cycle-level user data -> note text. The old code dumped the ENTIRE
        // cycle object, which wrote the user's Flo user_id, record ids and
        // created/updated timestamps into the note of every single period day.
        const cycleNotes: string[] = [];
        for (const [key, value] of Object.entries(cycle)) {
            if (FLO_CYCLE_METADATA_KEYS.has(key)) continue;
            if (!isNoteworthyValue(value)) continue;

            const words = key.split(/[/_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
            const valStr = typeof value === 'object'
                ? JSON.stringify(value)
                : stripTimeComponent(String(value));
            cycleNotes.push(`${words.join(' ')}: ${valStr}`);
        }

        // Per-day intensity, e.g. {"4": 1} = cycle day 4 was Low.
        const intensityByDay = floProperties(cycle.period_intensity);

        // Generate an entry for each day
        for (let i = 0; i < daysDiff; i++) {
            const currentTs = startTs + (i * 24 * 60 * 60 * 1000);
            const entry = entryFor(currentTs);
            entry.isPeriod = true;

            const rawLevel = intensityByDay[String(i + 1)];
            const mapped = typeof rawLevel === 'number' ? FLO_INTENSITY_TO_FLOW[rawLevel] : undefined;
            if (mapped !== undefined) {
                entry.flow = mapped;
            } else {
                // Flo's start/end range carries no intensity by itself.
                entry.flow = 2;
                if (rawLevel !== undefined) {
                    // Unknown scale value: preserve it rather than guess.
                    addNote(currentTs, `Period Intensity: ${String(rawLevel)}`);
                }
            }

            cycleNotes.forEach(n => addNote(currentTs, n));
            addNote(currentTs, `Flo Cycle Day: ${i + 1}`);
        }
    }

    // Container records skipped for an unusable date. Counted and warned rather
    // than dropped quietly — `skippedDays` alone never reaches the import UI.
    let skippedRecords = 0;

    // --- repeatable_child_point_events: recurring logs (Medication/Pills) ---
    for (const rec of Array.isArray(op.repeatable_child_point_events) ? op.repeatable_child_point_events : []) {
        if (!rec || rec.deleted === true) continue;

        const ts = tsOf(rec);
        if (ts === null) { skippedRecords++; stats.skippedDays++; continue; }

        entryFor(ts);
        const props = floProperties(rec.properties);
        const category = typeof rec.category === 'string' ? rec.category : '';
        const sub = typeof rec.subcategory === 'string' && rec.subcategory !== 'N/A' ? rec.subcategory : '';

        if (category === 'Medication' && /pill/i.test(sub) && typeof props.missed_pill === 'boolean') {
            // Rendered in Flo's OWN vocabulary (Medication / Pills / missed_pill),
            // deliberately NOT normalized to the Clue parser's phrasing.
            //
            // Note text is free text carried out of one specific app's export, and
            // two exports are not necessarily the same person — making them read
            // identically would assert an equivalence the data does not support.
            // The sources converge only where the domain is genuinely shared:
            // flow / period days, bbt, and symptom pills.
            addNote(ts, props.missed_pill ? 'Medication: Pills: Missed' : 'Medication: Pills: Taken On Time');
        } else if (sub) {
            addNote(ts, `${splitCamel(category || 'Logged')}: ${splitCamel(sub)}`);
        } else if (category) {
            addNote(ts, splitCamel(category));
        }
    }

    // --- point_events_manual_v2: one-off manual logs ---
    for (const rec of Array.isArray(op.point_events_manual_v2) ? op.point_events_manual_v2 : []) {
        if (!rec || rec.deleted === true) continue;

        const ts = tsOf(rec);
        if (ts === null) { skippedRecords++; stats.skippedDays++; continue; }

        const entry = entryFor(ts);
        const props = floProperties(rec.properties);
        const category = typeof rec.category === 'string' ? rec.category : '';
        const sub = typeof rec.subcategory === 'string' && rec.subcategory !== 'N/A' ? rec.subcategory : '';
        // Must be finite, or the note reads "Weight: NaN".
        const numeric = typeof props.value === 'number' && Number.isFinite(props.value) ? props.value
            : typeof props.volume === 'number' && Number.isFinite(props.volume) ? props.volume
                : undefined;

        if (category === 'Temperature' && numeric !== undefined) {
            entry.bbt = numeric;
        } else if (category === 'Symptom' || category === 'Mood') {
            // Bare phrase so recognized ones ("Tender Breasts") become pills.
            if (sub) addNote(ts, splitCamel(sub));
        } else if (numeric !== undefined) {
            addNote(ts, `${splitCamel(category || 'Value')}: ${numeric}`);
        } else if (sub) {
            addNote(ts, `${splitCamel(category || 'Logged')}: ${splitCamel(sub)}`);
        } else if (category) {
            addNote(ts, splitCamel(category));
        }
    }

    // --- notes: free text ---
    for (const rec of Array.isArray(op.notes) ? op.notes : []) {
        if (!rec || rec.deleted === true) continue;

        const ts = tsOf(rec);
        if (ts === null) { skippedRecords++; stats.skippedDays++; continue; }

        if (typeof rec.text === 'string' && rec.text.trim()) {
            entryFor(ts);
            addNote(ts, rec.text.trim());
        }
    }

    if (skippedRecords > 0) {
        warnings.push(`${skippedRecords} logged event(s) had no usable date and were skipped.`);
    }

    for (const [ts, list] of notesByTs) {
        if (list.length > 0) {
            const entry = byTs.get(ts);
            if (entry) entry.note = list.join(', ');
        }
    }

    // Drop days that ended up with nothing attached — e.g. an event carrying no
    // category, or a note record whose text was blank.
    const finalEntries = Array.from(byTs.values())
        .filter(hasImportableData)
        .sort((a, b) => a.ts - b.ts);

    applyBoundaryFlags(finalEntries);

    stats.totalDays = finalEntries.length;
    stats.periodDays = finalEntries.filter(e => e.isPeriod).length;

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
 *   note text   -> recognized symptom phrases (e.g. "Backache", "Fatigue") are
 *                  lifted into structured `symptoms` pills; unrecognized text
 *                  stays in the note. Source formats carry symptoms as free text,
 *                  so without this they would never light up their matching pill.
 */
export function ledgerEntryToLogEntry(entry: LedgerEntry): LogEntry {
    const hasBbt = typeof entry.bbt === 'number' && !Number.isNaN(entry.bbt);

    // Re-import dedup guard: BBT now lives in the dedicated `temperature` field.
    // If the source note already carries a legacy `"BBT: {value}"` token (e.g.
    // re-importing a file whose note text was written by the pre-T4 importer, or
    // that the T9 migration has since moved into `temperature`), strip it so the
    // value isn't duplicated across the note string and the temperature field.
    let noteText = '';
    if (entry.note) {
        noteText = hasBbt ? (parseBbtFromNote(entry.note)?.rest ?? entry.note) : entry.note;
    }

    // Lift recognized symptom phrases out of the note into structured pills; keep
    // whatever text didn't map (e.g. "Body Aches", "Spotting / Bleeding") as note.
    const { symptoms, rest } = extractSymptomsFromNote(noteText);

    const log: LogEntry = {
        event: entry.isStart ? 'period_start' : entry.isEnd ? 'period_end' : 'manual_entry',
        date: toLocalIsoDate(entry.ts),
        ts: entry.ts,
        isPeriod: entry.isPeriod,
    };

    if (entry.isStart) log.isStart = true;
    if (entry.isEnd) log.isEnd = true;
    if (rest) log.note = rest;
    if (symptoms.length > 0) log.symptoms = symptoms;

    const intensity = typeof entry.flow === 'number' ? FLOW_TO_INTENSITY[entry.flow] : undefined;
    if (intensity) log.bleeding = { intensity };

    if (hasBbt) {
        log.temperature = { value: entry.bbt as number, unit: inferTemperatureUnit(entry.bbt as number) };
    }

    return log;
}
