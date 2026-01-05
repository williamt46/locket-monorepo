import { useState, useEffect, useCallback } from 'react';
import { createPersistentLedger, TrafficPadding, StorageRecord } from '@locket/secure-storage';
import { LocketCryptoService } from '@locket/core-crypto';
import { BackgroundSyncService } from '../services/BackgroundSyncService';

// Singleton-ish instances for the lifetime of the session
let ledger: any = null;
const crypto = new LocketCryptoService();
let padding: any = null;

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
                ledger = await createPersistentLedger();
                padding = new TrafficPadding(ledger);
            }
            padding.start(); // Start background noise

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
        if (!isInitialized) return;
        setIsBusy(true);
        try {
            // This is the "Nuclear Option" - wipes data AND keys
            await ledger.nuke();
            const { SecureKeyService } = require('../services/SecureKeyService');
            await SecureKeyService.nukeKey();
            setEvents([]);
            console.log('[useLedger] SUPER NUKE: Data and Keys wiped.');
            // Reload app or state would be needed, but we'll at least clear the ledger
            await refresh(true);
        } catch (e) {
            console.error('[useLedger] Super Nuke failed', e);
        } finally {
            setIsBusy(false);
        }
    }, [isInitialized, refresh]);

    const triggerSync = useCallback(async () => {
        if (!isInitialized) return;
        console.log('[useLedger] Manual sync trigger requested');
        await BackgroundSyncService.forceSync(ledger, refresh);
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
        init();
        return () => {
            BackgroundSyncService.onStatusChange = () => { };
        };
    }, []);

    return {
        events,
        isInitialized,
        isBusy,
        isSyncing,
        inscribe,
        batchInscribe,
        deleteByTimestamp,
        triggerSync,
        refresh,
        nuke,
        superNuke
    };
};
