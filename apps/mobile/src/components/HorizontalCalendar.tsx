import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { MonthGrid } from './MonthGrid';
import { typography } from '../theme/typography';
import { colors } from '../theme/colors';

const SECTION_WIDTH = Dimensions.get('window').width;
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface HorizontalCalendarProps {
    year: number;
    data: Record<string, { isPeriod: boolean; isStart?: boolean; isEnd?: boolean; note?: string }>;
    futureData?: Record<string, boolean>;
    onToggleDate: (monthIndex: number, day: number) => void;
    initialMonthIndex: number;
}

export const HorizontalCalendar: React.FC<HorizontalCalendarProps> = ({
    year,
    data,
    futureData,
    onToggleDate,
    initialMonthIndex = 0
}) => {
    const flatListRef = useRef<FlatList>(null);

    // Scroll to initial index on mount or when year/initialIndex changes
    useEffect(() => {
        if (flatListRef.current && initialMonthIndex >= 0) {
            flatListRef.current.scrollToIndex({
                index: initialMonthIndex,
                animated: false // Instant jump for drill down feel
            });
        }
    }, [initialMonthIndex, year]); // Re-run if year changes too

    const renderItem = ({ item: monthIdx }: { item: number }) => {
        // Calculate if this page is the "Current Month" relative to real time
        const now = new Date();
        const isCurrentMonth = now.getFullYear() === year && now.getMonth() === monthIdx;

        return (
            <View style={styles.pageContainer}>
                <View style={styles.header}>
                    <Text style={styles.monthTitle}>{MONTH_NAMES[monthIdx]}</Text>
                    <Text style={styles.yearTitle}>{year}</Text>
                </View>

                {/* Card Container for the Month */}
                <View style={styles.card}>
                    <MonthGrid
                        year={year}
                        monthIndex={monthIdx}
                        data={data}
                        futureData={futureData}
                        onToggle={(day) => onToggleDate(monthIdx, day)}
                        interactive={true}
                        compact={false}
                        isCurrentMonth={isCurrentMonth}
                    />
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                renderItem={renderItem}
                keyExtractor={(item) => item.toString()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={SECTION_WIDTH}
                decelerationRate="fast"
                getItemLayout={(data, index) => ({
                    length: SECTION_WIDTH,
                    offset: SECTION_WIDTH * index,
                    index,
                })}
                initialScrollIndex={initialMonthIndex}
                onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                    });
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    pageContainer: {
        width: SECTION_WIDTH,
        alignItems: 'center',
        paddingTop: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    monthTitle: {
        fontFamily: typography.heading,
        fontSize: 32,
        color: colors.charcoal,
        letterSpacing: 1,
    },
    yearTitle: {
        fontFamily: typography.body,
        fontSize: 16,
        color: colors.graphite,
        marginTop: 4,
    },
    card: {
        // Optional: Add card styling or "page" shadow here if desired
        width: '90%',
    }
});
