import { useState, useEffect, useCallback } from 'react';
import { StorageRecord } from '@locket/secure-storage';
import { LocketCryptoService } from '@locket/core-crypto';
import { BackgroundSyncService } from '../services/BackgroundSyncService';
import { getLedger, resetLedgerSingleton, resetBaselineCache, nukeBaseline } from '../services/StorageService';
import type { LogEntry } from '../models/LogEntry';
import type { ImportPreview, CommitResult } from '../models/ImportTypes';
import { buildDateIndex, buildImportPreview, selectEntriesToInscribe } from '../services/importPreview';

/** Random id in the exact format FileSystemLedger mints, so CommitResult.inscribedIds is exact. */
function mintId(): string {
    return Math.random().toString(36).substring(7) + '-' + Date.now();
}

// Session cache of the SHARED ledger instance owned by StorageService (one
// singleton app-wide, sourced via getLedger() rather than a second instance).
let ledger: any = null;
const crypto = new LocketCryptoService();


export const useLedger = (keyHex?: string) => {
    const [events, setEvents] = useState<StorageRecord[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const refresh = useCallback(async (force = false) => {
        if (!isInitialized && !force) return;
        try {
            const data = await ledger.loadEvents();
            console.log(`[useLedger] Refresh found ${data.length} total events`);
            setEvents(data);
        } catch (e) {
            console.error('[useLedger] Refresh failed', e);
        }
    }, [isInitialized]);

    const init = useCallback(async () => {
        if (isInitialized && ledger) return;
        try {
            if (!ledger) {
                ledger = await getLedger();
            }

            // Wire up sync status updates
            BackgroundSyncService.onStatusChange = (syncing: boolean) => {
                setIsSyncing(syncing);
            };

            setIsInitialized(true);
            await refresh(true); // Force refresh as state update is async
        } catch (e) {
            console.error('[useLedger] Initialization failed', e);
        }
    }, [isInitialized, refresh]);

    const inscribe = useCallback(async (data: any) => {
        if (!isInitialized || !keyHex) throw new Error('Ledger not ready or key missing');
        setIsBusy(true);
        try {
            const ts = data.ts || Date.now();
            const encrypted = await crypto.encryptData(data, keyHex);
            const hash = await crypto.generateIntegrityHash(encrypted);
            const record: StorageRecord = {
                ts,
                payload: encrypted,
                status: 'local',
                signature: hash
            };

            await ledger.saveEvent(record);
            await refresh();
            console.log('[useLedger] Inscribed event at:', new Date(ts).toLocaleDateString());

            // Trigger optimistic sync check
            BackgroundSyncService.performSync(ledger, refresh);
        } catch (e) {
            console.error('[useLedger] Inscription failed', e);
            throw e;
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized, keyHex, refresh]);

    // Typed as LogEntry[] (not any[]) so malformed entries are a compile-time
    // error rather than a silent write. Mints a random id per record BEFORE
    // saveEvents (same format FileSystemLedger uses; saveEvents respects provided
    // ids) and RETURNS the ids so a commit can be undone exactly via purgeByIds.
    const batchInscribe = useCallback(async (entries: LogEntry[]): Promise<string[]> => {
        if (!isInitialized || !keyHex) throw new Error('Ledger not ready or key missing');
        setIsBusy(true);
        try {
            console.log(`[useLedger] Starting batch inscribe of ${entries.length} items`);
            const records: StorageRecord[] = [];
            const ids: string[] = [];

            for (const data of entries) {
                const ts = data.ts || Date.now();
                const id = mintId();
                const encrypted = await crypto.encryptData(data, keyHex);
                const hash = await crypto.generateIntegrityHash(encrypted);
                records.push({
                    id,
                    ts,
                    payload: encrypted,
                    status: 'local',
                    signature: hash
                });
                ids.push(id);
            }

            // Use the new atomic batch save method
            await ledger.saveEvents(records);
            await refresh();
            console.log(`[useLedger] Batch inscribed ${records.length} entries successfully`);

            // Trigger optimistic sync check (should hit the 7-event threshold immediately)
            BackgroundSyncService.performSync(ledger, refresh);

            return ids;
        } catch (e) {
            console.error('[useLedger] Batch inscription failed', e);
            throw e;
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized, keyHex, refresh]);

    const nuke = useCallback(async () => {
        if (!isInitialized) return;
        setIsBusy(true);
        try {
            // Cancel any in-flight sync first so a deferred write-back can't
            // re-persist records into the wiped store.
            BackgroundSyncService.invalidate();
            await ledger.nuke();
            setEvents([]);
            console.log('[useLedger] Ledger nuked');
        } catch (e) {
            console.error('[useLedger] Nuke failed', e);
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized]);

    const superNuke = useCallback(async () => {
        setIsBusy(true);
        try {
            // Invalidate any in-flight sync FIRST. Otherwise a deferred saveEvents
            // (e.g. from a force-sync still anchoring on-chain) can re-persist
            // pre-reset, old-key records into the wiped store — exactly the
            // resurrection that left undecryptable orphans after factory reset.
            BackgroundSyncService.invalidate();
            // This is the "Nuclear Option" - wipes data AND keys.
            // Must NOT guard on isInitialized — factory reset can be triggered before init completes.
            if (ledger) {
                await ledger.nuke();
            }
            // Shred the baseline cycle data (wrapped v2 + legacy plaintext) as part
            // of "wipe everything" — otherwise it survives the reset on disk.
            await nukeBaseline();
            const { SecureKeyService } = require('../services/SecureKeyService');
            await SecureKeyService.nukeKey();
            // Reset the shared singleton (StorageService's) AND the local cache so
            // the next init() builds a fresh ledger — no module keeps a handle to
            // the wiped/old-key ledger.
            resetLedgerSingleton();
            resetBaselineCache();
            ledger = null;
            setEvents([]);
            setIsInitialized(false);
            console.log('[useLedger] SUPER NUKE: Data and Keys wiped.');
        } catch (e) {
            console.error('[useLedger] Super Nuke failed', e);
            throw e; // fail loud — the caller must not report success on a partial wipe
        } finally {
            setIsBusy(false);
        }
    }, []);

    const triggerSync = useCallback(async () => {
        if (!isInitialized) return;
        console.log('[useLedger] Manual sync trigger requested');
        await BackgroundSyncService.forceSync(ledger, refresh);
    }, [isInitialized, refresh]);

    const purgeByIds = useCallback(async (ids: string[]): Promise<{ removedCount: number }> => {
        if (!isInitialized || !ledger) return { removedCount: 0 };
        if (!ids || ids.length === 0) return { removedCount: 0 };
        if (typeof ledger.deleteByIds !== 'function') {
            console.warn('[useLedger] Active ledger does not support deleteByIds; cannot purge.');
            return { removedCount: 0 };
        }
        setIsBusy(true);
        try {
            // deleteByIds returns the number of records actually removed (missing
            // ids simply don't count). This feeds the §14 UndoResult.removedCount.
            const removedCount = await ledger.deleteByIds(ids);
            await refresh();
            console.log(`[useLedger] Purged ${removedCount} unreadable record(s) by id`);
            return { removedCount };
        } catch (e) {
            // Fail loud: the caller must not treat a failed purge as success.
            console.error('[useLedger] Purge failed', e);
            throw e;
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized, refresh]);

    const deleteByTimestamp = useCallback(async (ts: number) => {
        if (!isInitialized) return;
        setIsBusy(true);
        try {
            if (ledger.deleteByTimestamp) {
                await ledger.deleteByTimestamp(ts);
                await refresh();
                console.log('[useLedger] Deleted events for timestamp:', ts);
            }
        } catch (e) {
            console.error('[useLedger] Delete failed', e);
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized, refresh]);

    useEffect(() => {
        if (!isInitialized) {
            init();
        }
        return () => {
            BackgroundSyncService.onStatusChange = () => { };
        };
    }, [isInitialized]);

    // PRODUCE (file): detect → parse → assert → map to LogEntry[]. Shared by the
    // backward-compatible importData wrapper and producePreviewFromFile. Pure
    // apart from the lazy require; throws on unrecognized/empty input.
    const produceFileLogEntries = (rawString: string): { logEntries: LogEntry[]; result: any } => {
        // Lazy load ImportService to avoid circular/heavy deps on boot if not importing
        const { detectFormat, detectSource, parseClueExport, parseFloExport, parseCsvExport, ledgerEntryToLogEntry, assertImportHasEntries } = require('../services/ImportService');

        const format = detectFormat(rawString);
        let result;

        if (format === 'csv') {
            result = parseCsvExport(rawString);
        } else if (format === 'json') {
            const jsonObj = JSON.parse(rawString);
            const source = detectSource(jsonObj);

            if (source === 'clue') {
                result = parseClueExport(jsonObj);
            } else if (source === 'flo') {
                result = parseFloExport(jsonObj);
            } else {
                // Name the right file: an export folder holds a dozen JSONs and
                // only one of them is importable, so "unrecognized" alone leaves
                // the user guessing which to pick.
                throw new Error(
                    'Unrecognized JSON export schema (not Clue or Flo). ' +
                    'From a Clue export folder choose measurements.json; ' +
                    'from a Flo export choose the .json file (not res.txt).'
                );
            }
        } else {
            throw new Error(
                'Unrecognized file format. Must be Clue/Flo JSON or spreadsheet CSV. ' +
                'Flo\'s res.txt and notes.txt are not importable — use the .json file.'
            );
        }

        // Fail closed: a recognized FILE that yields no entries is an error (the
        // Flo NaN-date bug once showed "Records Inscribed: 0" with no signal).
        // NOTE: this guard is file-only. The HealthKit path deliberately does NOT
        // route through it — a zero-sample HK query is 'ambiguous-zero', a
        // permission state carried in the preview, not a corrupted file.
        if (!result || result.entries.length === 0) {
            console.warn('[useLedger] Import recognized the format but produced 0 entries.');
        }
        assertImportHasEntries(result);

        // Convert import-domain LedgerEntry into app-domain LogEntry so imported
        // days render on the Log modal and calendar.
        const logEntries: LogEntry[] = result.entries.map(ledgerEntryToLogEntry);
        return { logEntries, result };
    };

    // Decrypt the existing ledger ONCE (the `events` state is ciphertext — §11
    // E12) to build a date→LogEntry index for collision detection. Off the render
    // path; undecryptable records are skipped (count logged, never values).
    const decryptExistingEntries = useCallback(async (): Promise<LogEntry[]> => {
        if (!keyHex) throw new Error('Ledger not ready or key missing');
        const records: StorageRecord[] = await ledger.loadEvents();
        const out: LogEntry[] = [];
        let failed = 0;
        for (const rec of records) {
            try {
                const data = await crypto.decryptData(rec.payload, keyHex);
                if (data && typeof data === 'object') out.push(data as LogEntry);
            } catch {
                failed++;
            }
        }
        if (failed > 0) {
            console.warn(`[useLedger] ${failed} existing record(s) undecryptable for preview index`);
        }
        return out;
    }, [keyHex]);

    // Backward-compatible file import: produce → inscribe ALL entries (the
    // pre-preview append-all behavior the current ImportScreen relies on) →
    // return the legacy summary shape. Built on the new internals.
    const importData = useCallback(async (rawString: string) => {
        if (!isInitialized) throw new Error('Ledger not initialized');
        setIsBusy(true);
        try {
            const { logEntries, result } = produceFileLogEntries(rawString);
            console.log(`[useLedger] Mapped ${logEntries.length} items from ${result.source}, beginning batch inscribe...`);
            await batchInscribe(logEntries);
            return {
                success: true,
                count: result.entries.length,
                source: result.source,
                warnings: result.warnings,
                stats: result.stats
            };
        } catch (e) {
            console.error('[useLedger] Data import failed', e);
            throw e;
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized, batchInscribe]);

    // PRODUCE → PREVIEW (file): parse a file into an ImportPreview with per-row
    // collision detection against the decrypted ledger. File sources are always
    // permissionState 'available' with no truncation.
    const producePreviewFromFile = useCallback(async (rawString: string): Promise<ImportPreview> => {
        if (!isInitialized) throw new Error('Ledger not initialized');
        setIsBusy(true);
        try {
            const { logEntries, result } = produceFileLogEntries(rawString);
            const existing = await decryptExistingEntries();
            return buildImportPreview({
                source: result.source,
                logEntries,
                existingByDate: buildDateIndex(existing),
                permissionState: 'available',
                truncation: null,
            });
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized, decryptExistingEntries]);

    // PRODUCE → PREVIEW (HealthKit): one-shot read → map → ImportPreview. A
    // zero-sample query yields an empty preview whose permissionState is
    // 'ambiguous-zero' (never the corrupted-file assert). `source` is injectable
    // for testing; production builds a real HealthKitSource. Lazy-required so the
    // native library is not pulled into the app boot graph.
    const producePreviewFromHealthKit = useCallback(async (source?: any): Promise<ImportPreview> => {
        if (!isInitialized) throw new Error('Ledger not initialized');
        setIsBusy(true);
        try {
            const { HealthKitSource } = require('../services/HealthKitSource');
            const { mapHealthKitSamples } = require('../services/healthkitMapping');
            const { ledgerEntryToLogEntry } = require('../services/ImportService');

            const src = source ?? new HealthKitSource();
            if (!src.isAvailable()) {
                throw new Error('Apple Health is not available on this device');
            }
            const queryResult = await src.query();
            const ledgerEntries = mapHealthKitSamples(queryResult);
            const logEntries: LogEntry[] = ledgerEntries.map(ledgerEntryToLogEntry);
            const existing = await decryptExistingEntries();
            return buildImportPreview({
                source: 'healthkit',
                logEntries,
                existingByDate: buildDateIndex(existing),
                permissionState: queryResult.permissionState,
                truncation: queryResult.truncation,
            });
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized, decryptExistingEntries]);

    // COMMIT (§14 guarantee 2): inscribe every non-collision row + every
    // 'import-anyway' row, nothing else. Returns the exact ids written so Undo
    // (purgeByIds) can remove precisely this import.
    const commitPreview = useCallback(async (preview: ImportPreview): Promise<CommitResult> => {
        const { toInscribe, skippedCount } = selectEntriesToInscribe(preview);
        if (toInscribe.length === 0) {
            return { inscribedIds: [], inscribedCount: 0, skippedCount };
        }
        const inscribedIds = await batchInscribe(toInscribe);
        return { inscribedIds, inscribedCount: inscribedIds.length, skippedCount };
    }, [batchInscribe]);

    return {
        events,
        isInitialized,
        isBusy,
        isSyncing,
        inscribe,
        batchInscribe,
        importData,
        producePreviewFromFile,
        producePreviewFromHealthKit,
        commitPreview,
        deleteByTimestamp,
        purgeByIds,
        triggerSync,
        refresh,
        nuke,
        superNuke
    };
};
