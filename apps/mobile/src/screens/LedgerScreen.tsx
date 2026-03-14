import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar, AppState } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { IntegritySeal } from '../components/IntegritySeal';
import { HorizontalCalendar } from '../components/HorizontalCalendar';
import { VerticalYearView } from '../components/VerticalYearView';
import { DataEntryModal } from '../components/DataEntryModal';
import * as Haptics from 'expo-haptics';
import { useLedger } from '../hooks/useLedger';
import { SecureKeyService } from '../services/SecureKeyService';
import { LocketCryptoService } from '@locket/core-crypto';
import { getUserConfig, saveUserConfig } from '../services/StorageService';
import { UserConfig } from '../models/UserConfig';
import { usePredictions } from '../hooks/usePredictions';

import { Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export const LedgerScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const crypto = useMemo(() => new LocketCryptoService(), []);

    // State
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [initialMonthIndex, setInitialMonthIndex] = useState<number>(new Date().getMonth());
    const [keyHex, setKeyHex] = useState<string | undefined>(undefined);
    const { events, inscribe, batchInscribe, deleteByTimestamp, triggerSync, superNuke, isInitialized, isSyncing } = useLedger(keyHex);

    const styles = StyleSheet.create({
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 10,
        },
        headerLeft: {
            flex: 1,
        },
        headerTitle: {
            fontFamily: typography.heading,
            fontSize: 24,
            color: colors.charcoal,
            fontWeight: 'bold',
        },
        headerRight: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        content: {
            flex: 1,
        },
        footerContainer: {
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100, // Ensure it floats above
        },
        toggleButton: {
            backgroundColor: colors.charcoal,
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 30,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 5,
        },
        toggleText: {
            fontFamily: typography.body,
            color: colors.paper,
            fontSize: 14,
            fontWeight: '600',
        },
    });

    console.warn(`[LedgerScreen] Render. Total Events: ${events.length}, Initialized: ${isInitialized}`);



    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Current Date State
    const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
    const [config, setConfig] = useState<UserConfig | null>(null);

    // Initialize Key and Config
    useEffect(() => {
        SecureKeyService.getOrGenerateKey().then(setKeyHex).catch(console.error);
        getUserConfig().then(setConfig).catch(console.error);
    }, []);

    // Handle incoming navigation jumps (e.g. from Import success)
    useEffect(() => {
        if (route.params?.jumpToTs) {
            const d = new Date(route.params.jumpToTs);
            const y = d.getFullYear();
            const m = d.getMonth();

            setTimeout(() => {
                setViewMode('monthly');
                setCurrentYear(y);
                setInitialMonthIndex(m);
            }, 100);

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
                    await superNuke();
                    SecureKeyService.getOrGenerateKey().then((val) => {
                        setKeyHex(val);
                    });
                    Alert.alert('Reset Complete', 'Your local ledger has been wiped.');
                };
                clearAll();
            }
        }
    }, [route.params?.action, triggerSync, superNuke, setKeyHex, navigation]);

    // Decrypt events for UI with memoization
    const [decryptedData, setDecryptedData] = useState<Record<string, any>>({});
    const decryptionCache = useRef<Record<string, any>>({});

    useEffect(() => {
        const decryptAll = async () => {
            if (!keyHex) return;
            if (events.length === 0) {
                setDecryptedData({});
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
                } catch (e) {
                    console.error('Decryption failed for event', event.id);
                }
                return null;
            });

            const results = await Promise.all(promises);
            const validResults = results.filter(r => r !== null);
            console.log(`[LedgerScreen] Decrypted ${validResults.length} / ${events.length} events successfully`);

            const prevKeyCount = Object.keys(decryptedData).length;
            for (const result of validResults) {
                const { event, decrypted } = result;
                const tsToUse = decrypted?.ts || event.ts;
                const d = new Date(tsToUse);
                const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

                const dataObj = (decrypted && typeof decrypted === 'object') ? decrypted : { isPeriod: true };

                // Only set if not already set, so latest (first in list) wins
                if (!newData[k]) {
                    newData[k] = {
                        ...dataObj,
                        ts: tsToUse,
                        isPeriod: dataObj.isPeriod !== undefined ? dataObj.isPeriod : true
                    };
                }
            }
            setDecryptedData(newData);

        };
        decryptAll();
    }, [events, keyHex]);



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

    const { futureData, cycleStats } = usePredictions(decryptedData, config);

    const handleToggleDate = (monthIndex: number, day: number) => {
        // Open Modal instead of direct toggle
        const date = new Date(currentYear, monthIndex, day);
        setSelectedDate(date);
        setModalVisible(true);
    };

    const handleSaveData = async (modalData: { isStart?: boolean; isEnd?: boolean; note?: string; delete?: boolean }) => {
        if (!selectedDate || !keyHex) return;

        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();

        if (modalData.delete) {
            try {
                const ts = selectedDate.getTime();
                const dateStr = selectedDate.toLocaleDateString();
                await deleteByTimestamp(ts);
                console.log('[LedgerScreen] Deleted data for:', dateStr);
            } catch (e) {
                console.error('Delete failed', e);
            }
            setModalVisible(false);
            return;
        }

        try {
            console.log('[LedgerScreen] Saving data:', modalData, 'for date:', selectedDate.toLocaleDateString());
            const length = config?.periodLength || 5;

            if (modalData.isStart) {
                // Batch Inscribe based on user's periodLength
                const batch = [];
                for (let i = 0; i < length; i++) {
                    const d = new Date(year, month, day + i);
                    const record: any = {
                        ts: d.getTime(),
                        isPeriod: true,
                        isStart: i === 0,
                        isEnd: i === length - 1,
                    };
                    if (i === 0 && modalData.note) {
                        record.note = modalData.note;
                    }
                    batch.push(record);
                }
                await batchInscribe(batch);
                console.log(`[LedgerScreen] Inscribed batch of ${batch.length} days starting from ${selectedDate.toLocaleDateString()}`);
            } else if (modalData.isEnd) {
                const batch = [];
                // End date is selectedDate, so we want (length) days leading UP to it
                const startDate = new Date(year, month, day - (length - 1));
                for (let i = 0; i < length; i++) {
                    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
                    const record: any = {
                        ts: d.getTime(),
                        isPeriod: true,
                        isStart: i === 0,
                        isEnd: i === length - 1,
                    };
                    if (i === length - 1 && modalData.note) {
                        record.note = modalData.note;
                    }
                    batch.push(record);
                }
                await batchInscribe(batch);
                console.log(`[LedgerScreen] Inscribed batch of ${batch.length} days ending at ${selectedDate.toLocaleDateString()}`);
            } else {
                await inscribe({
                    ts: selectedDate.getTime(),
                    note: modalData.note,
                    isPeriod: true
                });
            }
        } catch (e) {
            console.error('Save failed', e);
        }

        setModalVisible(false);
    };

    // Aggregate Integrity Status
    const sealStatus = useMemo(() => {
        if (!isInitialized) return 'pending';
        if (isSyncing) return 'syncing';
        if (events.length === 0) return 'secure';

        const localWithSig = events.filter(e => e.status === 'local' && e.signature);
        const localsWithoutSig = events.filter(e => e.status === 'local' && !e.signature);
        const anchoredCount = events.filter(e => e.status === 'anchored').length;

        if (localWithSig.length > 0) return 'secure';
        if (anchoredCount > 0) return 'anchored';
        return 'secure';
    }, [isInitialized, isSyncing, events]);

    const handleDrillDown = (monthIndex: number, year: number) => {
        // Tapping month in Year view drills down to Monthly view
        setViewMode('monthly');
        setInitialMonthIndex(monthIndex);
        setCurrentYear(year); // Correctly update the year for HorizontalCalendar
    };


    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>Locket</Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Settings"
                        onPress={() => navigation.navigate('Settings', {
                            keyHex,
                            isSyncing,
                            sealStatus
                        })}
                        style={{ padding: 4 }}
                    >
                        <Text style={{ fontSize: 24, color: colors.charcoal }}>⚙️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.content}>
                {viewMode === 'monthly' ? (
                    <HorizontalCalendar
                        year={currentYear}
                        data={decryptedData}
                        futureData={futureData}
                        onToggleDate={handleToggleDate}
                        initialMonthIndex={initialMonthIndex}
                    />
                ) : (
                    <VerticalYearView
                        // Chronological Order: Oldest at Top
                        years={[2024, 2025, 2026]}
                        data={decryptedData}
                        futureData={futureData}
                        cycleStats={cycleStats}
                        onMonthPress={handleDrillDown}
                    />
                )}
            </View>

            {/* Data Entry Modal */}
            <DataEntryModal
                visible={modalVisible}
                date={selectedDate}
                initialData={selectedDate ? decryptedData[`${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`] : undefined}
                onClose={() => setModalVisible(false)}
                onSave={handleSaveData}
            />

            {/* Anchored Footer Toggle */}
            <View style={styles.footerContainer}>
                <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setViewMode(prev => prev === 'monthly' ? 'yearly' : 'monthly');
                    }}
                >
                    <Text style={styles.toggleText}>
                        {viewMode === 'monthly' ? 'Yearly View' : 'Back to Calendar'}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper >
    );
};
