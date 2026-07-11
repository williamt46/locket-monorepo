import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { LocketCryptoService } from '@locket/core-crypto';
import { useLedger } from './useLedger';
import { getUserConfig } from '../services/StorageService';
import { BaselineCycleData } from '../models/BaselineCycleData';
import { runBbtNoteMigration } from '../utils/bbtNoteMigration';

/**
 * Decrypt-once ledger access, shared by LedgerScreen and CycleInsightsScreen.
 *
 * Owns the single source of truth for decrypted per-day data so Insights no
 * longer consumes a by-value `route.params` snapshot that goes stale the moment
 * the Insights → Log → back loop writes a new event (eng-review blocker E1).
 * Both screens call this hook with the same key and see the same live data;
 * it also refreshes the underlying events whenever a consuming screen regains
 * focus, so a save on one screen is reflected on the other without a remount.
 *
 * Wraps `useLedger(keyHex)` and re-exposes its full API so callers that also
 * mutate the ledger (LedgerScreen) can keep using one hook.
 */
export function useDecryptedLedger(keyHex?: string) {
    const crypto = useMemo(() => new LocketCryptoService(), []);
    const ledger = useLedger(keyHex);
    const { events, refresh } = ledger;

    // Refresh events whenever a consuming screen comes into focus (e.g. after a
    // LogScreen inscribe from either the calendar or the Insights Log CTA).
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    // ─── Baseline config (live, so Insights sees edits without param passing) ──
    const [config, setConfig] = useState<BaselineCycleData | null>(null);

    const reloadConfig = useCallback(() => {
        return getUserConfig()
            .then((c) => {
                setConfig(c);
                return c;
            })
            .catch((e) => {
                console.error('[useDecryptedLedger] Config load failed', e);
                return null;
            });
    }, []);

    useEffect(() => {
        reloadConfig();
    }, [reloadConfig]);

    // ─── Decrypt-once (lifted verbatim from LedgerScreen) ──────────────────────
    const [decryptedData, setDecryptedData] = useState<Record<string, any>>({});
    const [undecryptableIds, setUndecryptableIds] = useState<string[]>([]);
    const decryptionCache = useRef<Record<string, any>>({});

    useEffect(() => {
        const decryptAll = async () => {
            if (!keyHex) return;
            if (events.length === 0) {
                setDecryptedData({});
                setUndecryptableIds([]);
                return;
            }

            console.log(`[useDecryptedLedger] Decrypting ${events.length} events...`);

            const newData: Record<string, any> = {};
            const promises = events.map(async (event) => {
                const cacheKey = `${event.id}_${event.signature}`;
                if (decryptionCache.current[cacheKey]) {
                    return { event, decrypted: decryptionCache.current[cacheKey] };
                }

                try {
                    const decrypted = await crypto.decryptData(event.payload, keyHex);
                    if (decrypted && typeof decrypted === 'object') {
                        decryptionCache.current[cacheKey] = decrypted;
                        return { event, decrypted };
                    }
                    // Decrypted to a non-object — unexpected; treat as unreadable
                    // rather than silently discarding it.
                    console.warn('Decryption produced a non-object payload for event', event.id);
                    return { event, failed: true };
                } catch (e: any) {
                    // Surface the real reason (e.g. GCM auth failure from a key reset)
                    // instead of swallowing it.
                    console.error('Decryption failed for event', event.id, e?.message ?? e);
                    return { event, failed: true };
                }
            });

            const results = await Promise.all(promises);
            const validResults = results.filter((r: any) => r && !r.failed);
            const failedIds: string[] = results
                .filter((r: any) => r && r.failed && r.event?.id)
                .map((r: any) => r.event.id);
            console.log(`[useDecryptedLedger] Decrypted ${validResults.length} / ${events.length} events successfully`);
            if (failedIds.length > 0) {
                console.warn(`[useDecryptedLedger] ${failedIds.length} event(s) unreadable (likely created before a key reset).`);
            }
            setUndecryptableIds(failedIds);

            for (const result of validResults) {
                const { event, decrypted } = result as any;
                const tsToUse = decrypted?.ts || event.ts;
                const d = new Date(tsToUse);
                const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

                const dataObj = (decrypted && typeof decrypted === 'object') ? decrypted : { isPeriod: true };

                // Events arrive newest-first (ORDER BY ts DESC, rowid DESC). Merge per-day:
                // fields from newer events win, older events only fill gaps. This keeps a
                // symptoms-only save and a period/bleeding save for the same day from
                // clobbering each other (each inscribe appends a separate event).
                const existing = newData[k];
                const merged = { ...dataObj, ...(existing ?? {}) };
                // Preserve the newest ts (existing is newer when present).
                merged.ts = existing?.ts ?? tsToUse;
                merged.isPeriod = merged.isPeriod !== undefined ? merged.isPeriod : true;
                newData[k] = merged;
            }
            setDecryptedData(newData);
        };
        decryptAll();
    }, [events, keyHex, crypto]);

    // ─── One-time BBT-note migration (T9) ──────────────────────────────────────
    // Pull legacy `"BBT: {value}"` note text (written by the pre-T4 importer) into
    // the dedicated `temperature` field and strip it from the note. Runs once per
    // install (persisted SecureStore flag), re-encrypting each changed record via
    // the same crypto path as any other edit. Fires after the ledger has decrypted
    // (keyHex present); refreshes so the rewritten payloads reload in-session.
    const migrationRan = useRef(false);
    useEffect(() => {
        if (!keyHex || migrationRan.current) return;
        migrationRan.current = true;
        runBbtNoteMigration(keyHex)
            .then((rewritten) => {
                if (rewritten > 0) refresh();
            })
            .catch((e) => console.error('[useDecryptedLedger] BBT note migration failed', e));
    }, [keyHex, refresh]);

    return {
        ...ledger,
        decryptedData,
        undecryptableIds,
        setUndecryptableIds,
        config,
        setConfig,
        reloadConfig,
    };
}
