import { useState, useEffect, useCallback, useMemo } from 'react';
import { SQLiteLedger, TrafficPadding, StorageRecord } from '@locket/secure-storage';
import { LocketCryptoService } from '@locket/core-crypto';

// Singleton-ish instances for the lifetime of the session
const ledger = new SQLiteLedger();
const crypto = new LocketCryptoService();
const padding = new TrafficPadding(ledger);

export const useLedger = (keyHex?: string) => {
    const [events, setEvents] = useState<StorageRecord[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isBusy, setIsBusy] = useState(false);

    const init = useCallback(async () => {
        if (isInitialized) return;
        try {
            await ledger.init();
            padding.start(); // Start background noise
            setIsInitialized(true);
            await refresh();
        } catch (e) {
            console.error('[useLedger] Initialization failed', e);
        }
    }, [isInitialized]);

    const refresh = useCallback(async () => {
        if (!isInitialized) return;
        try {
            const data = await ledger.loadEvents();
            setEvents(data);
        } catch (e) {
            console.error('[useLedger] Refresh failed', e);
        }
    }, [isInitialized]);

    const inscribe = useCallback(async (data: any) => {
        if (!isInitialized || !keyHex) throw new Error('Ledger not ready or key missing');
        setIsBusy(true);
        try {
            // 1. Encrypt Data (Async, off main thread)
            const encrypted = await crypto.encryptData(data, keyHex);

            // 2. Generate Deterministic Hash for Integrity Seal
            const hash = await crypto.generateIntegrityHash(encrypted);

            // 3. Save to Relational SQLite
            const record: StorageRecord = {
                ts: Date.now(),
                payload: encrypted,
                status: 'local',
                signature: hash // Using hash as local integrity signature
            };

            await ledger.saveEvent(record);
            await refresh();
            console.log('[useLedger] Inscribed event with hash:', hash);
        } catch (e) {
            console.error('[useLedger] Inscription failed', e);
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

    useEffect(() => {
        init();
        return () => {
            // we don't necessarily stop padding here as it's a global singleton in this implementation
            // but in a real app we might manage lifecycle more strictly
        };
    }, []);

    return {
        events,
        isInitialized,
        isBusy,
        inscribe,
        refresh,
        nuke
    };
};
