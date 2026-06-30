import { useState, useEffect, useCallback } from 'react';
import { StorageRecord } from '@locket/secure-storage';
import { LocketCryptoService } from '@locket/core-crypto';
import { BackgroundSyncService } from '../services/BackgroundSyncService';
import { getLedger, resetLedgerSingleton } from '../services/StorageService';

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

    const batchInscribe = useCallback(async (entries: any[]) => {
        if (!isInitialized || !keyHex) throw new Error('Ledger not ready or key missing');
        setIsBusy(true);
        try {
            console.log(`[useLedger] Starting batch inscribe of ${entries.length} items`);
            const records: StorageRecord[] = [];

            for (const data of entries) {
                const ts = data.ts || Date.now();
                const encrypted = await crypto.encryptData(data, keyHex);
                const hash = await crypto.generateIntegrityHash(encrypted);
                records.push({
                    ts,
                    payload: encrypted,
                    status: 'local',
                    signature: hash
                });
            }

            // Use the new atomic batch save method
            await ledger.saveEvents(records);
            await refresh();
            console.log(`[useLedger] Batch inscribed ${entries.length} entries successfully`);

            // Trigger optimistic sync check (should hit the 7-event threshold immediately)
            BackgroundSyncService.performSync(ledger, refresh);
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
            const { SecureKeyService } = require('../services/SecureKeyService');
            await SecureKeyService.nukeKey();
            // Reset the shared singleton (StorageService's) AND the local cache so
            // the next init() builds a fresh ledger — no module keeps a handle to
            // the wiped/old-key ledger.
            resetLedgerSingleton();
            ledger = null;
            setEvents([]);
            setIsInitialized(false);
            console.log('[useLedger] SUPER NUKE: Data and Keys wiped.');
        } catch (e) {
            console.error('[useLedger] Super Nuke failed', e);
        } finally {
            setIsBusy(false);
        }
    }, []);

    const triggerSync = useCallback(async () => {
        if (!isInitialized) return;
        console.log('[useLedger] Manual sync trigger requested');
        await BackgroundSyncService.forceSync(ledger, refresh);
    }, [isInitialized, refresh]);

    const purgeByIds = useCallback(async (ids: string[]) => {
        if (!isInitialized || !ledger) return;
        if (!ids || ids.length === 0) return;
        if (typeof ledger.deleteByIds !== 'function') {
            console.warn('[useLedger] Active ledger does not support deleteByIds; cannot purge.');
            return;
        }
        setIsBusy(true);
        try {
            await ledger.deleteByIds(ids);
            await refresh();
            console.log(`[useLedger] Purged ${ids.length} unreadable record(s) by id`);
        } catch (e) {
            console.error('[useLedger] Purge failed', e);
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

    const importData = useCallback(async (rawString: string) => {
        if (!isInitialized) throw new Error('Ledger not initialized');
        setIsBusy(true);
        try {
            // Lazy load ImportService to avoid circular/heavy deps on boot if not importing
            const { detectFormat, detectSource, parseClueExport, parseFloExport, parseCsvExport, ledgerEntryToLogEntry } = require('../services/ImportService');

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
                    throw new Error('Unrecognized JSON export schema (not Clue or Flo)');
                }
            } else {
                throw new Error('Unrecognized file format. Must be Clue/Flo JSON or spreadsheet CSV.');
            }

            if (!result || result.entries.length === 0) {
                console.warn('[useLedger] Import parsed successfully but no valid entries were found.');
                return { success: true, count: 0, warnings: result?.warnings || [] };
            }

            // Convert import-domain LedgerEntry (numeric flow/bbt) into app-domain
            // LogEntry (bleeding.intensity + note) so imported days render correctly
            // on the Log modal and calendar. Without this, spotting/flow and BBT
            // never surface in the UI after import.
            const logEntries = result.entries.map(ledgerEntryToLogEntry);

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

    return {
        events,
        isInitialized,
        isBusy,
        isSyncing,
        inscribe,
        batchInscribe,
        importData,
        deleteByTimestamp,
        purgeByIds,
        triggerSync,
        refresh,
        nuke,
        superNuke
    };
};
