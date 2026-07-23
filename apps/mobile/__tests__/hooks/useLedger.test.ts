import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    detectFormat,
    detectSource,
    parseClueExport,
    parseFloExport,
    parseCsvExport,
    assertImportHasEntries,
    ledgerEntryToLogEntry,
} from '../../src/services/ImportService';
import type { ClueExport, FloExport } from '../../src/models/ImportTypes';
import type { StorageRecord } from '@locket/secure-storage';

/**
 * T2 — Regression suite for the EXISTING import path, locked in BEFORE the
 * planned produce -> preview -> commit refactor of useLedger.importData.
 *
 * APPROACH (stated per the task): the repo has NO hook-rendering infrastructure
 * (@testing-library/react, react-test-renderer are all absent — verified) and
 * we may not install dependencies. useLedger.importData / batchInscribe are
 * defined inside the hook via useCallback and are not exported, so they cannot
 * be rendered or imported directly.
 *
 * We therefore pin the contract in two halves, both of which the refactor must
 * preserve:
 *   (1) PRODUCE — the pure ImportService pipeline that importData drives
 *       (detectFormat -> detectSource -> parse -> assertImportHasEntries ->
 *       ledgerEntryToLogEntry) is exercised against real ImportService code with
 *       small inline fixtures modeled on __tests__/import/fixtures.
 *   (2) COMMIT — batchInscribe's observable contract (encrypt each entry, hash
 *       each encrypted package, call ledger.saveEvents EXACTLY ONCE with all
 *       records, and throw 'Ledger not ready or key missing' writing NOTHING
 *       when the key is absent) is pinned via a hand-rolled harness that mirrors
 *       useLedger.ts:77-109 verbatim, driven by a mocked crypto service (same
 *       mocking style as __tests__/services/BackgroundSyncService.test.ts) and a
 *       mocked ledger. Keep the harness in sync with batchInscribe across the
 *       refactor — it is the executable spec of the commit step.
 */

// --- Inline fixtures (modeled on __tests__/import/fixtures) -----------------

// Clue legacy `{ data: [...] }` shape — this is the shape importData feeds to
// parseClueExport for source === 'clue'.
const CLUE_FIXTURE: ClueExport = {
    data: [
        { day: '2024-01-01', 'period/light': true, bbt: 97.4 },
        { day: '2024-01-02', 'period/heavy': true },
        { day: '2024-01-04', spotting: true },
    ],
} as unknown as ClueExport;

const FLO_FIXTURE: FloExport = {
    operationalData: {
        cycles: [{ period_start_date: '2024-02-01', period_end_date: '2024-02-03' }],
    },
} as unknown as FloExport;

const CSV_FIXTURE = 'date,flow,bbt,note\n2024-03-01,medium,,long day\n2024-03-02,spotting,,';

// --- Crypto service mock (mirrors LocketCryptoService's shape) --------------

function makeCrypto() {
    return {
        encryptData: vi.fn(async (data: any, _keyHex: string) => ({
            iv: 'iv',
            encryptedData: `enc:${JSON.stringify(data)}`,
            authTag: 'tag',
        })),
        generateIntegrityHash: vi.fn(async (pkg: any) => `hash:${pkg.encryptedData}`),
    };
}

function makeLedger() {
    return { saveEvents: vi.fn(async (_records: StorageRecord[]) => undefined) };
}

/**
 * Hand-rolled mirror of useLedger.batchInscribe (apps/mobile/src/hooks/useLedger.ts).
 * Reproduces the exact commit loop and guard so the observable contract is
 * asserted independently of React.
 *
 * MIGRATED to the Phase 1 API: batchInscribe now mints a random id per record
 * BEFORE saveEvents and RETURNS the ids (so CommitResult.inscribedIds is exact
 * and Undo can purge precisely this import). Records are observable via the
 * saveEvents mock; the function returns the id list.
 */
function mintId(): string {
    return Math.random().toString(36).substring(7) + '-' + Date.now();
}

async function batchInscribeHarness(
    entries: any[],
    ctx: { crypto: ReturnType<typeof makeCrypto>; ledger: ReturnType<typeof makeLedger>; keyHex?: string; isInitialized: boolean },
): Promise<string[]> {
    if (!ctx.isInitialized || !ctx.keyHex) throw new Error('Ledger not ready or key missing');
    const records: StorageRecord[] = [];
    const ids: string[] = [];
    for (const data of entries) {
        const ts = data.ts || Date.now();
        const id = mintId();
        const encrypted = await ctx.crypto.encryptData(data, ctx.keyHex);
        const hash = await ctx.crypto.generateIntegrityHash(encrypted);
        records.push({ id, ts, payload: encrypted, status: 'local', signature: hash });
        ids.push(id);
    }
    await ctx.ledger.saveEvents(records);
    return ids;
}

// Mirror of importData's produce stage (useLedger.ts:218-264), minus React.
function produceLogEntries(rawString: string) {
    const format = detectFormat(rawString);
    let result;
    if (format === 'csv') {
        result = parseCsvExport(rawString);
    } else if (format === 'json') {
        const jsonObj = JSON.parse(rawString);
        const source = detectSource(jsonObj);
        if (source === 'clue') result = parseClueExport(jsonObj);
        else if (source === 'flo') result = parseFloExport(jsonObj);
        else throw new Error('Unrecognized JSON export schema (not Clue or Flo).');
    } else {
        throw new Error('Unrecognized file format.');
    }
    assertImportHasEntries(result);
    return { result, logEntries: result.entries.map(ledgerEntryToLogEntry) };
}

describe('T2 produce stage — importData pipeline (real ImportService)', () => {
    it('parses Clue JSON end-to-end and maps to LogEntry[] tagged source=clue', () => {
        const raw = JSON.stringify(CLUE_FIXTURE);
        expect(detectFormat(raw)).toBe('json');
        expect(detectSource(CLUE_FIXTURE)).toBe('clue');
        const { result, logEntries } = produceLogEntries(raw);
        expect(result.source).toBe('clue');
        expect(logEntries.length).toBeGreaterThan(0);
        expect(logEntries.every((e) => e.source === 'clue')).toBe(true);
        // period/light on 2024-01-01 -> light bleeding.
        const jan1 = logEntries.find((e) => e.date === '2024-01-01');
        expect(jan1?.bleeding?.intensity).toBe('light');
    });

    it('parses Flo JSON end-to-end and maps to LogEntry[] tagged source=flo', () => {
        const raw = JSON.stringify(FLO_FIXTURE);
        expect(detectSource(FLO_FIXTURE)).toBe('flo');
        const { result, logEntries } = produceLogEntries(raw);
        expect(result.source).toBe('flo');
        expect(logEntries.length).toBeGreaterThan(0);
        expect(logEntries.every((e) => e.source === 'flo')).toBe(true);
        expect(logEntries.every((e) => e.isPeriod)).toBe(true);
    });

    it('parses CSV end-to-end and maps to LogEntry[] tagged source=csv', () => {
        expect(detectFormat(CSV_FIXTURE)).toBe('csv');
        const { result, logEntries } = produceLogEntries(CSV_FIXTURE);
        expect(result.source).toBe('csv');
        expect(logEntries.length).toBeGreaterThan(0);
        expect(logEntries.every((e) => e.source === 'csv')).toBe(true);
        const mar1 = logEntries.find((e) => e.date === '2024-03-01');
        expect(mar1?.bleeding?.intensity).toBe('medium');
        expect(mar1?.note).toBe('long day');
    });

    it('fail-closed: a recognized file that maps to zero entries throws (assertImportHasEntries)', () => {
        // Empty Clue data array parses fine but yields no entries.
        const raw = JSON.stringify({ data: [] });
        expect(() => produceLogEntries(raw)).toThrow();
    });
});

describe('T2 commit stage — batchInscribe observable contract', () => {
    let crypto: ReturnType<typeof makeCrypto>;
    let ledger: ReturnType<typeof makeLedger>;

    beforeEach(() => {
        crypto = makeCrypto();
        ledger = makeLedger();
    });

    it('encrypts and hashes EACH entry, mints ids, and calls saveEvents exactly once with all records', async () => {
        const entries = [
            { ts: 1000, note: 'a' },
            { ts: 2000, note: 'b' },
            { ts: 3000, note: 'c' },
        ];
        const ids = await batchInscribeHarness(entries, { crypto, ledger, keyHex: 'deadbeef', isInitialized: true });

        expect(crypto.encryptData).toHaveBeenCalledTimes(3);
        expect(crypto.generateIntegrityHash).toHaveBeenCalledTimes(3);
        expect(ledger.saveEvents).toHaveBeenCalledTimes(1);

        const saved = (ledger.saveEvents as any).mock.calls[0][0];
        expect(saved).toHaveLength(3);
        expect(saved.map((r: StorageRecord) => r.ts)).toEqual([1000, 2000, 3000]);
        expect(saved.every((r: StorageRecord) => r.status === 'local')).toBe(true);
        // signature is the integrity hash of the encrypted payload.
        expect(saved[0].signature).toBe(`hash:${saved[0].payload.encryptedData}`);
        // Phase 1: ids are minted before write and returned; they match the
        // records handed to saveEvents exactly (the undo contract depends on it).
        expect(ids).toHaveLength(3);
        expect(saved.map((r: StorageRecord) => r.id)).toEqual(ids);
        expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    });

    it("throws 'Ledger not ready or key missing' and writes NOTHING when the key is absent", async () => {
        await expect(
            batchInscribeHarness([{ ts: 1, note: 'x' }], { crypto, ledger, keyHex: undefined, isInitialized: true }),
        ).rejects.toThrow('Ledger not ready or key missing');
        expect(crypto.encryptData).not.toHaveBeenCalled();
        expect(ledger.saveEvents).not.toHaveBeenCalled();
    });

    it('throws and writes nothing when the ledger is not initialized', async () => {
        await expect(
            batchInscribeHarness([{ ts: 1, note: 'x' }], { crypto, ledger, keyHex: 'deadbeef', isInitialized: false }),
        ).rejects.toThrow('Ledger not ready or key missing');
        expect(ledger.saveEvents).not.toHaveBeenCalled();
    });

    it('drives the full produce -> commit path for a CSV import', async () => {
        const { logEntries } = produceLogEntries(CSV_FIXTURE);
        await batchInscribeHarness(logEntries, { crypto, ledger, keyHex: 'deadbeef', isInitialized: true });
        expect(ledger.saveEvents).toHaveBeenCalledTimes(1);
        const saved = (ledger.saveEvents as any).mock.calls[0][0];
        expect(saved).toHaveLength(logEntries.length);
    });
});
