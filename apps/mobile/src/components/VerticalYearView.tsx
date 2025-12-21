import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { MonthGrid } from './MonthGrid';
import { typography } from '../theme/typography';
import { colors } from '../theme/colors';

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

interface VerticalYearViewProps {
    years: number[];
    data: Record<string, { isPeriod: boolean; isStart?: boolean; isEnd?: boolean; note?: string }>;
    futureData: Record<string, boolean>;
    cycleStats: Record<number, number>; // year -> avgCycleLength
    onMonthPress: (monthIndex: number, year: number) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export const VerticalYearView: React.FC<VerticalYearViewProps> = ({
    years,
    data,
    futureData,
    cycleStats,
    onMonthPress
}) => {

    const renderYear = (year: number) => {
        const avgCycle = cycleStats[year];

        return (
            <View key={year} style={styles.yearContainer}>
                {/* Year Header + Stats */}
                <View style={styles.yearHeader}>
                    <Text style={styles.yearTitle}>{year}</Text>
                    <View style={styles.statsContainer}>
                        {avgCycle ? (
                            <Text style={styles.statsText}>Avg Cycle: {avgCycle} Days</Text>
                        ) : (
                            <Text style={styles.statsText}>No Data</Text>
                        )}
                    </View>
                </View>

                {/* Months Grid (3 columns x 4 rows) */}
                <View style={styles.monthsContainer}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((monthIdx) => {
                        // Check for "Today" so we can render Blinker in Yearly view too if desired
                        // Note: MonthGrid renders blinker on specific DAY.
                        // For Yearly view, we might just want to pass the prop to let it handle it.
                        const now = new Date();
                        const isCurrentMonth = now.getFullYear() === year && now.getMonth() === monthIdx;

                        return (
                            <TouchableOpacity
                                key={monthIdx}
                                style={styles.monthWrapper}
                                onPress={() => onMonthPress(monthIdx, year)}
                            >
                                <Text style={styles.monthLabel}>{MONTH_NAMES[monthIdx]}</Text>
                                <MonthGrid
                                    year={year}
                                    monthIndex={monthIdx}
                                    data={data}
                                    futureData={futureData}
                                    interactive={false}
                                    compact={true}
                                    isCurrentMonth={isCurrentMonth}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {years.map(y => renderYear(y))}
            <View style={{ height: 100 }} />
            {/* Bottom padding for Footer */}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingTop: 20,
    },
    yearContainer: {
        marginBottom: 40,
    },
    yearHeader: {
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    yearTitle: {
        fontFamily: typography.heading,
        fontSize: 36,
        color: colors.charcoal,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    statsText: {
        fontFamily: typography.body,
        fontSize: 12,
        color: colors.graphite,
    },
    statsDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.graphite,
        marginHorizontal: 8,
    },
    monthsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        paddingHorizontal: 10,
    },
    monthWrapper: {
        width: (SCREEN_WIDTH - 20) / 3, // 3 Columns
        alignItems: 'center',
        marginBottom: 20,
    },
    monthLabel: {
        fontFamily: typography.heading,
        fontSize: 12,
        color: colors.inkBlue,
        marginBottom: 4,
        opacity: 0.8,
    },
});
