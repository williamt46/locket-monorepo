import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { VerticalCalendar, VerticalCalendarHandle } from '../components/VerticalCalendar';
import { NavPill } from '../components/DesignSystem';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';
import { useLedger } from '../hooks/useLedger';
import { SecureKeyService } from '../services/SecureKeyService';
import { LocketCryptoService } from '@locket/core-crypto';
import { getUserConfig, saveUserConfig } from '../services/StorageService';
import { BaselineCycleData } from '../models/BaselineCycleData';
import { usePredictions } from '../hooks/usePredictions';
import { keyFingerprint } from '../utils/keyFingerprint';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

export const LedgerScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { t } = useTheme();
    const crypto = useMemo(() => new LocketCryptoService(), []);

    const [keyHex, setKeyHex] = useState<string | undefined>(undefined);
    const { events, batchInscribe, purgeByIds, triggerSync, superNuke, refresh, isInitialized, isSyncing } = useLedger(keyHex);

    const calendarRef = useRef<VerticalCalendarHandle>(null);

    // Ids of events that failed to decrypt (e.g. orphaned by a key reset). Surfaced
    // to the user rather than silently dropped.
    const [undecryptableIds, setUndecryptableIds] = useState<string[]>([]);
    const purgePromptedRef = useRef<string>('');

    // Refresh event state whenever this screen comes into focus (e.g. after LogScreen inscribes)
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    const [config, setConfig] = useState<BaselineCycleData | null>(null);

    // Initialize Key and Config
    useEffect(() => {
        SecureKeyService.getOrGenerateKey().then(setKeyHex).catch(console.error);
        getUserConfig().then(setConfig).catch(console.error);
    }, []);

    // Handle incoming navigation jumps (e.g. from Import success)
    useEffect(() => {
        if (route.params?.jumpToTs) {
            const d = new Date(route.params.jumpToTs);
            setTimeout(() => calendarRef.current?.scrollToDate(d, false), 150);
            // Clear param so it doesn't fire again
            navigation.setParams({ jumpToTs: undefined });
        }
    }, [route.params?.jumpToTs, navigation]);

    // Handle incoming settings actions
    useEffect(() => {
        if (route.params?.action) {
            const action = route.params.action;
            navigation.setParams({ action: undefined }); // clear immediately

            if (action === 'triggerSync') {
                triggerSync();
            } else if (action === 'factoryReset') {
                const clearAll = async () => {
                    setKeyHex(undefined);
                    try {
                        await superNuke();
                    } catch {
                        // Fail loud: do NOT mint a new key over a half-shredded
                        // state, and do NOT claim success.
                        Alert.alert('Reset Failed', 'Some data could not be wiped. Please try again.');
                        return;
                    }
                    // Generate a fresh key only after a fully-confirmed wipe.
                    const newKey = await SecureKeyService.getOrGenerateKey();
                    console.log(`[Reset] fresh master key minted fp=${keyFingerprint(newKey)}`);
                    setKeyHex(newKey);
                    Alert.alert('Reset Complete', 'Your local ledger has been wiped.');
                };
                clearAll();
            } else if (action === 'restored') {
                // A v2 restore just rebound the master key. Re-read it so the
                // ledger decrypts the restored events under the correct (installed)
                // key — keeps undecryptableIds empty so the purge prompt does not
                // fire on freshly-restored data — then reload the ledger.
                const reload = async () => {
                    const restoredKey = await SecureKeyService.getOrGenerateKey();
                    console.log(`[Restore] resident master key now fp=${keyFingerprint(restoredKey)}`);
                    setKeyHex(restoredKey);
                    await refresh(true);
                };
                reload();
            } else if (action === 'configChanged') {
                // Baseline editor in Settings saved new cycle data — reload it so
                // predictions recompute against the new baseline.
                getUserConfig().then(setConfig).catch(console.error);
            }
        }
    }, [route.params?.action, triggerSync, superNuke, setKeyHex, navigation, refresh]);

    // Decrypt events for UI with memoization
    const [decryptedData, setDecryptedData] = useState<Record<string, any>>({});
    const decryptionCache = useRef<Record<string, any>>({});

    useEffect(() => {
        const decryptAll = async () => {
            if (!keyHex) return;
            if (events.length === 0) {
                setDecryptedData({});
                setUndecryptableIds([]);
                return;
            }

            console.log(`[LedgerScreen] Decrypting ${events.length} events...`);

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
            console.log(`[LedgerScreen] Decrypted ${validResults.length} / ${events.length} events successfully`);
            if (failedIds.length > 0) {
                console.warn(`[LedgerScreen] ${failedIds.length} event(s) unreadable (likely created before a key reset).`);
            }
            setUndecryptableIds(failedIds);

            for (const result of validResults) {
                const { event, decrypted } = result;
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
    }, [events, keyHex]);

    // Surface unreadable entries (orphaned by a key reset) once per distinct set,
    // and offer to purge them. They are unrecoverable — their key no longer exists.
    useEffect(() => {
        if (undecryptableIds.length === 0) return;
        const sig = [...undecryptableIds].sort().join('|');
        if (purgePromptedRef.current === sig) return; // already prompted for this set
        purgePromptedRef.current = sig;

        const n = undecryptableIds.length;
        Alert.alert(
            'Some entries can’t be read',
            `${n} ${n === 1 ? 'entry' : 'entries'} could not be decrypted. This usually means they were created before a factory reset, under a key that no longer exists, so they can’t be recovered. Remove them?`,
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        await purgeByIds(undecryptableIds);
                        setUndecryptableIds([]);
                    },
                },
            ]
        );
    }, [undecryptableIds, purgeByIds]);

    // Initial Seeding: if onboarding is complete but ledger is empty, generate initial period logs
    useEffect(() => {
        if (isInitialized && keyHex && config && !config.hasSeededInitialData && events.length === 0 && !isSyncing) {
            console.log('[LedgerScreen] Seeding initial data from Onboarding...');

            const seedData = async () => {
                const batch = [];
                // Parse UTC string strictly
                const [y, m, d] = config.lastPeriodDate.split('-');
                const startDate = new Date(Date.UTC(+y, +m - 1, +d));

                for (let i = 0; i < config.periodLength; i++) {
                    const date = new Date(startDate);
                    date.setUTCDate(date.getUTCDate() + i);

                    const record: any = {
                        ts: date.getTime(),
                        isPeriod: true,
                        isStart: i === 0,
                        isEnd: i === config.periodLength - 1,
                    };
                    if (i === 0) {
                        record.note = "Initial Record from Onboarding";
                    }
                    batch.push(record);
                }

                try {
                    await batchInscribe(batch);
                    const updatedConfig = { ...config, hasSeededInitialData: true };
                    await saveUserConfig(updatedConfig);
                    setConfig(updatedConfig);
                    console.log(`[LedgerScreen] Successfully seeded ${batch.length} initial entries.`);
                } catch (e) {
                    console.error('[LedgerScreen] Initial seed failed:', e);
                }
            };

            seedData();
        }
    }, [isInitialized, keyHex, config, events.length, isSyncing, batchInscribe]);

    const { futureData, cycleStats, currentPhase, dayInCycle } = usePredictions(decryptedData, config);

    const handleToggleDate = (year: number, monthIndex: number, day: number) => {
        const date = new Date(year, monthIndex, day);
        // Local-midnight timestamps of every logged period day — lets LogScreen clear the orphan
        // days of an existing period run when a boundary is re-marked (span-clearing on re-mark).
        const existingPeriodDays = Object.keys(decryptedData)
            .filter((k) => decryptedData[k]?.isPeriod)
            .map((k) => {
                const [y, m, d] = k.split('-').map(Number);
                return new Date(y, m, d).getTime();
            });
        navigation.navigate('Log', {
            date: date.toISOString(),
            initialData: decryptedData[`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`],
            keyHex,
            currentPhase,
            periodLength: config?.periodLength,
            existingPeriodDays,
            // Note: inscribe and deleteByTimestamp are NOT passed — LogScreen calls useLedger(keyHex) directly.
            // Passing functions via route.params causes React Navigation non-serializable warnings and breaks deep linking.
        });
    };

    // Aggregate Integrity Status
    const sealStatus = useMemo(() => {
        if (!isInitialized) return 'pending';
        if (isSyncing) return 'syncing';
        if (events.length === 0) return 'secure';

        const localWithSig = events.filter(e => e.status === 'local' && e.signature);
        const anchoredCount = events.filter(e => e.status === 'anchored').length;

        if (localWithSig.length > 0) return 'secure';
        if (anchoredCount > 0) return 'anchored';
        return 'secure';
    }, [isInitialized, isSyncing, events]);

    return (
        <ScreenWrapper>
            {/* Floating header: Today pill left, main nav pill right */}
            <View style={styles.header}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Scroll to today"
                    onPress={() => calendarRef.current?.scrollToToday()}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    style={[styles.todayPill, {
                        backgroundColor: t.navBg,
                        shadowColor: t.shadowColor,
                        shadowOpacity: t.shadowOpacity,
                    }]}
                >
                    <Text style={[styles.todayText, { color: t.ink }]}>Today</Text>
                </TouchableOpacity>

                <NavPill
                    active="ledger"
                    onCalendar={() => calendarRef.current?.scrollToToday()}
                    onInsights={() => navigation.navigate('CycleInsights', {
                        currentPhase,
                        dayInCycle,
                        cycleStats,
                        decryptedDays: decryptedData,
                        baseline: config ? {
                            cycleLength: config.cycleLength,
                            periodLength: config.periodLength,
                            lastPeriodDate: config.lastPeriodDate,
                        } : null,
                        // Pass-through so the nav pill on Insights can open Settings directly
                        keyHex,
                        isSyncing,
                        sealStatus,
                    })}
                    onSettings={() => navigation.navigate('Settings', {
                        keyHex,
                        isSyncing,
                        sealStatus,
                    })}
                />
            </View>

            <View style={styles.content}>
                <VerticalCalendar
                    ref={calendarRef}
                    data={decryptedData}
                    futureData={futureData}
                    onToggleDate={handleToggleDate}
                />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 10,
    },
    todayPill: {
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 999,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 4,
    },
    todayText: {
        fontFamily: font(600),
        fontSize: 13,
        opacity: 0.72,
    },
    content: {
        flex: 1,
    },
});
