import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar, AppState } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { IntegritySeal } from '../components/IntegritySeal';
import { HorizontalCalendar } from '../components/HorizontalCalendar';
import { VerticalYearView } from '../components/VerticalYearView';
import { DataEntryModal } from '../components/DataEntryModal';
import * as Haptics from 'expo-haptics';

export const LedgerScreen = () => {
    // State
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [initialMonthIndex, setInitialMonthIndex] = useState<number>(new Date().getMonth());
    // Use DayData object structure
    const [cycleData, setCycleData] = useState<Record<string, { isPeriod: boolean; isStart?: boolean; isEnd?: boolean; note?: string }>>({});
    const [futureData, setFutureData] = useState<Record<string, boolean>>({});

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Current Date State
    const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

    // Generate specific predictions for demo when component mounts
    useEffect(() => {
        const mockFuture: Record<string, boolean> = {};

        // Mark 10-14 of NEXT month relative to now as "Future"
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // Logic for "Next Month" safely handling December
        let targetYear = year;
        let targetMonth = month + 1;
        if (targetMonth > 11) {
            targetMonth = 0;
            targetYear += 1;
        }

        // Mock 5 days of predicted period
        for (let d = 10; d <= 14; d++) {
            mockFuture[`${targetYear}-${targetMonth}-${d}`] = true;
        }
        setFutureData(mockFuture);
    }, []);

    const calculateAverageCycle = (data: Record<string, { isPeriod: boolean }>): Record<number, number> => {
        // Real Calculation Logic
        // 1. Parse keys into Dates
        const dates: Date[] = [];
        Object.keys(data).forEach(key => {
            const parts = key.split('-');
            if (parts.length === 3 && data[key].isPeriod) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                const d = parseInt(parts[2], 10);
                dates.push(new Date(y, m, d));
            }
        });

        if (dates.length < 2) {
            return {};
        }

        // 2. Sort Dates
        dates.sort((a, b) => a.getTime() - b.getTime());

        // 3. Identify Cycles (Group consecutive days into 'Periods', measure distance between Starts)
        const periodStarts: Date[] = [];
        let lastDate: Date | null = null;

        for (const date of dates) {
            if (!lastDate) {
                periodStarts.push(date);
            } else {
                // If gap is > 5 days (arbitrary threshold for new cycle vs same period), it's a new period
                const diffTime = Math.abs(date.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 5) {
                    periodStarts.push(date);
                }
            }
            lastDate = date;
        }

        if (periodStarts.length < 2) return {};

        // 4. Calculate Average Interval per Year of the START date
        const intervalsByYear: Record<number, number[]> = {};

        for (let i = 1; i < periodStarts.length; i++) {
            const start = periodStarts[i - 1];
            const end = periodStarts[i];
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const year = end.getFullYear();
            if (!intervalsByYear[year]) intervalsByYear[year] = [];
            intervalsByYear[year].push(days);
        }

        // 5. Average them
        const avgs: Record<number, number> = {};
        for (const y in intervalsByYear) {
            const arr = intervalsByYear[y];
            const total = arr.reduce((sum, val) => sum + val, 0);
            avgs[y] = Math.round(total / arr.length);
        }

        return avgs;
    };

    const cycleStats = useMemo(() => calculateAverageCycle(cycleData), [cycleData]);

    const handleToggleDate = (monthIndex: number, day: number) => {
        // Open Modal instead of direct toggle
        const date = new Date(currentYear, monthIndex, day);
        setSelectedDate(date);
        setModalVisible(true);
    };

    const handleSaveData = (modalData: { isStart?: boolean; isEnd?: boolean; note?: string; delete?: boolean }) => {
        if (!selectedDate) return;

        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();
        const targetKey = `${year}-${month}-${day}`;

        setCycleData(prev => {
            const newState = { ...prev };

            if (modalData.delete) {
                if (newState[targetKey]) {
                    delete newState[targetKey];
                }
                setModalVisible(false);
                return newState;
            }

            // Helper to get key from date
            const getKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

            // Conflict Logic
            const clearConflicts = (windowStart: Date, windowEnd: Date) => {
                Object.keys(newState).forEach(existingKey => {
                    if (!newState[existingKey].isPeriod) return;

                    const parts = existingKey.split('-');
                    const existingDate = new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));

                    // Buffer +/- 3 days
                    const buffer = 3 * 24 * 60 * 60 * 1000;
                    if (existingDate.getTime() >= windowStart.getTime() - buffer &&
                        existingDate.getTime() <= windowEnd.getTime() + buffer) {
                        delete newState[existingKey];
                    }
                });
            };

            // AUTO-FILL LOGIC
            if (modalData.isStart) {
                const startDate = new Date(year, month, day);
                const endDate = new Date(year, month, day + 6); // 7 days inclusive

                clearConflicts(startDate, endDate);

                for (let i = 0; i < 7; i++) {
                    const d = new Date(year, month, day + i);
                    const k = getKey(d);
                    newState[k] = {
                        isPeriod: true,
                        isStart: i === 0,
                        isEnd: i === 6,
                        note: i === 0 ? modalData.note : undefined
                    };
                }
            } else if (modalData.isEnd) {
                const endDate = new Date(year, month, day);
                const startDate = new Date(year, month, day - 6);

                clearConflicts(startDate, endDate);

                for (let i = 0; i < 7; i++) {
                    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
                    const k = getKey(d);
                    newState[k] = {
                        isPeriod: true,
                        isStart: i === 0,
                        isEnd: i === 6,
                        note: i === 6 ? modalData.note : undefined
                    };
                }
            } else {
                // Just saving note
                const currentEntry = newState[targetKey] || { isPeriod: false };
                newState[targetKey] = {
                    ...currentEntry,
                    note: modalData.note,
                    isPeriod: true // Implicitly create entry if note added
                };
            }

            return newState;
        });
        setModalVisible(false);
    };

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
                    <IntegritySeal status="secure" />
                </View>
            </View>

            <View style={styles.content}>
                {viewMode === 'monthly' ? (
                    <HorizontalCalendar
                        year={currentYear}
                        data={cycleData}
                        futureData={futureData}
                        onToggleDate={handleToggleDate}
                        initialMonthIndex={initialMonthIndex}
                    />
                ) : (
                    <VerticalYearView
                        // Chronological Order: Oldest at Top
                        years={[2024, 2025, 2026]}
                        data={cycleData}
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
                initialData={selectedDate ? cycleData[`${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`] : undefined}
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
        </ScreenWrapper>
    );
};

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
