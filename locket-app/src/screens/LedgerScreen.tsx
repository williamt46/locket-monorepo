import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, SafeAreaView } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { WinslowGrid } from '../components/WinslowGrid';
import { CycleLengthTable } from '../components/CycleLengthTable';
import { IntegritySeal } from '../components/IntegritySeal';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Helper: Get JS Date from our data format (Month is 0-indexed)
const getDate = (y: number, m: number, d: number) => new Date(y, m, d);

// Helper: Calculate diff in days between two dates
const getDaysDiff = (start: Date, end: Date) => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper: Calculate cycle lengths (Supports Cross-Year)
const calculateCycleLengths = (fullData: Record<string, boolean>, year: number) => {
    const lengths: Record<string, number | null> = {};
    const MONTHS_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    // Flatten starts for current year -> next year partial
    // We need to find starts in (Current Year) and (Next Year) to compute gaps.
    const starts: { date: Date; monthIndex: number; year: number }[] = [];

    // Scan Current Year AND Next Year to ensure we catch the crossover
    [year, year + 1].forEach(y => {
        let lastMarkedDate = 0; // timestamp

        for (let m = 0; m < 12; m++) {
            for (let d = 1; d <= DAYS_IN_MONTH[m]; d++) {
                if (fullData[`${y}-${m}-${d}`]) {
                    const currentDate = getDate(y, m, d);
                    const currentTimestamp = currentDate.getTime();

                    // Gap heuristic (7 days)
                    // 7 days * 24h * 60m * 60s * 1000ms = 604800000
                    if (currentTimestamp - lastMarkedDate > 604800000) {
                        starts.push({ date: currentDate, monthIndex: m, year: y });
                    }
                    lastMarkedDate = currentTimestamp;
                }
            }
        }
    });

    // Calculate intervals
    for (let i = 0; i < starts.length - 1; i++) {
        const current = starts[i];
        const next = starts[i + 1];

        // We only care about displaying lengths for starts occurring in the *Requested Year*
        if (current.year === year) {
            const diff = getDaysDiff(current.date, next.date);
            const label = MONTHS_LABELS[current.monthIndex];

            // Store first found cycle for that month slot
            if (lengths[label] === undefined) {
                lengths[label] = diff;
            }
        }
    }

    // Initialize nulls
    MONTHS_LABELS.forEach(m => {
        if (lengths[m] === undefined) lengths[m] = null;
    });

    return lengths;
};

const YearPage = ({ year, data, fullData, onToggle }: any) => {
    // Use fullData for calculation to see into next year
    const cycleLengths = useMemo(() => calculateCycleLengths(fullData, year), [fullData, year]);

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
            <View style={styles.headerContainer}>
                <Text style={styles.yearHeader}>The Ledger {year}</Text>
                <IntegritySeal status="secure" />
            </View>

            <View style={styles.gridContainer}>
                {/* Grid still visualizes just THIS year's data (stripped) */}
                <WinslowGrid year={year} data={data} onToggle={onToggle} />
            </View>

            <CycleLengthTable data={cycleLengths} />
            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

export const LedgerScreen = () => {
    // Store data keyed by "Year-Month-Day" logic, but simplified here
    // For MVP: key = `year-month-day`
    const [data, setData] = useState<Record<string, boolean>>({});

    const toggleDay = (year: number, monthIndex: number, day: number) => {
        const key = `${year}-${monthIndex}-${day}`;
        setData(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Filter data for specific year props
    const getDataForYear = (year: number) => {
        const yearPrefix = `${year}-`;
        const yearData: Record<string, boolean> = {};
        Object.keys(data).forEach(k => {
            if (k.startsWith(yearPrefix)) {
                const [_, m, d] = k.split('-'); // extract m-d
                yearData[`${m}-${d}`] = data[k];
            }
        });
        return yearData;
    };

    return (
        <ScreenWrapper>
            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ width: SCREEN_WIDTH * 2 }} // 2 Years
            >
                <YearPage
                    year={2024}
                    data={getDataForYear(2024)}
                    fullData={data}
                    onToggle={(m: number, d: number) => toggleDay(2024, m, d)}
                />
                <YearPage
                    year={2025}
                    data={getDataForYear(2025)}
                    fullData={data}
                    onToggle={(m: number, d: number) => toggleDay(2025, m, d)}
                />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    page: {
        width: SCREEN_WIDTH,
        flex: 1,
    },
    pageContent: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    yearHeader: {
        fontFamily: typography.serif,
        fontSize: 24,
        color: colors.ink,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        gap: 8,
    },
    gridContainer: {
        width: '100%',
        alignItems: 'center',
    },
});
