import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { VerticalCalendar, VerticalCalendarHandle } from '../components/VerticalCalendar';
import { NavPill } from '../components/DesignSystem';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';
import { useDecryptedLedger } from '../hooks/useDecryptedLedger';
import { SecureKeyService } from '../services/SecureKeyService';
import { saveUserConfig } from '../services/StorageService';
import { hasRealAnchor } from '../models/BaselineCycleData';
import { usePredictions } from '../hooks/usePredictions';
import { buildLogNavParams } from '../utils/buildLogNavParams';
import { keyFingerprint } from '../utils/keyFingerprint';
import { useNavigation, useRoute } from '@react-navigation/native';

export const LedgerScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { t } = useTheme();

    const [keyHex, setKeyHex] = useState<string | undefined>(undefined);
    const {
        events,
        decryptedData,
        undecryptableIds,
        setUndecryptableIds,
        config,
        setConfig,
        reloadConfig,
        batchInscribe,
        purgeByIds,
        triggerSync,
        superNuke,
        refresh,
        isInitialized,
        isSyncing,
    } = useDecryptedLedger(keyHex);

    const calendarRef = useRef<VerticalCalendarHandle>(null);

    // Ids of events that failed to decrypt are surfaced (via the hook) rather than
    // silently dropped; this ref throttles the purge prompt to once per set.
    const purgePromptedRef = useRef<string>('');

    // Initialize Key (baseline config is loaded live by useDecryptedLedger)
    useEffect(() => {
        SecureKeyService.getOrGenerateKey().then(setKeyHex).catch(console.error);
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
                reloadConfig();
            }
        }
    }, [route.params?.action, triggerSync, superNuke, setKeyHex, navigation, refresh, reloadConfig]);

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

    // Initial Seeding: if onboarding is complete but ledger is empty, generate initial period logs.
    // T7/§4: an "I'm not sure" onboarding run leaves `lastPeriodDate` undefined (or flags it as
    // estimated). In that case there is NO real anchor to seed from — skip seeding entirely and let
    // predictions stay dormant until the first logged Period Start. Guarding here also prevents the
    // `config.lastPeriodDate.split('-')` crash on an undefined date.
    useEffect(() => {
        if (isInitialized && keyHex && config && !config.hasSeededInitialData && hasRealAnchor(config) && events.length === 0 && !isSyncing) {
            console.log('[LedgerScreen] Seeding initial data from Onboarding...');

            const seedData = async () => {
                const batch = [];
                // Parse UTC string strictly (lastPeriodDate is guaranteed present by hasRealAnchor)
                const [y, m, d] = config.lastPeriodDate!.split('-');
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

    const { futureData, currentPhase } = usePredictions(decryptedData, config);

    // Stable across renders so the memoized MonthGrid never re-renders off-screen
    // months just because the toggle handler identity changed (T1 memoization).
    const handleToggleDate = useCallback(
        (year: number, monthIndex: number, day: number) => {
            const date = new Date(year, monthIndex, day);
            navigation.navigate('Log', {
                ...buildLogNavParams(decryptedData, config, date),
                keyHex,
                currentPhase,
                // Note: inscribe and deleteByTimestamp are NOT passed — LogScreen calls useLedger(keyHex) directly.
                // Passing functions via route.params causes React Navigation non-serializable warnings and breaks deep linking.
            });
        },
        [navigation, decryptedData, config, keyHex, currentPhase]
    );

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
                        // Insights derives phase/day/history live via useDecryptedLedger(keyHex)
                        // — decryptedDays/baseline are no longer passed by value (would go stale
                        // after the Insights → Log → back loop). Only the key + status travel.
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
