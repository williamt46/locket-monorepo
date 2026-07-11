import React, { useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { phaseColor } from '../theme/colors';
import { font } from '../theme/typography';
import { phaseForDay } from '../utils/phaseBoundaries';
import { buildCycleDayCells, CycleDayCell } from '../utils/cycleStrip';

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const CELL_WIDTH = 44;
const CELL_GAP = 8;
const CELL_STRIDE = CELL_WIDTH + CELL_GAP;

interface DayStripProps {
    /** 0-indexed current day-in-cycle (today). */
    dayInCycle: number;
    cycleLength: number;
    periodLength: number;
    /** Shared selection: 0-indexed cycle day, or null = today. */
    selectedDay: number | null;
    /** Fires with the tapped cell's 0-indexed cycle day. */
    onSelect: (dayIndex: number) => void;
    /** When true, programmatic centering is instant (Reduce Motion). */
    reduceMotion?: boolean;
}

/**
 * Horizontal full-cycle day strip (T5). One 44×56 pt cell per day of the
 * current cycle (day 1 → predicted end, extended to today when overdue).
 * Selected cell = phase-color filled circle, today = ring outline, future
 * (predicted) days at 50% opacity. Shares one selection state with the gauge.
 */
export const DayStrip: React.FC<DayStripProps> = ({
    dayInCycle,
    cycleLength,
    periodLength,
    selectedDay,
    onSelect,
    reduceMotion,
}) => {
    const { t } = useTheme();
    const listRef = useRef<FlatList<CycleDayCell>>(null);

    const cells = useMemo(
        () => buildCycleDayCells(dayInCycle, cycleLength, new Date()),
        [dayInCycle, cycleLength],
    );

    const todayIdx = Math.max(0, dayInCycle);
    const effectiveSelected = selectedDay ?? todayIdx;

    const getItemLayout = useCallback(
        (_: unknown, index: number) => ({
            length: CELL_STRIDE,
            offset: CELL_STRIDE * index,
            index,
        }),
        [],
    );

    const renderItem = useCallback(
        ({ item }: { item: CycleDayCell }) => {
            const phase = phaseForDay(item.dayIndex, cycleLength, periodLength);
            const pc = phaseColor(t, phase);
            const isSelected = item.dayIndex === effectiveSelected;
            const label = `${item.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, cycle day ${item.dayIndex + 1}, ${phase}${isSelected ? ', selected' : ''}`;
            return (
                <TouchableOpacity
                    style={[styles.cell, item.isFuture && { opacity: 0.5 }]}
                    onPress={() => onSelect(item.dayIndex)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isSelected }}
                >
                    <Text style={[styles.dow, { color: item.isToday ? pc : t.fog }]}>
                        {DOW[item.date.getDay()]}
                    </Text>
                    <View
                        style={[
                            styles.numberWrap,
                            isSelected && { backgroundColor: pc },
                            !isSelected && item.isToday && { borderWidth: 2, borderColor: pc },
                        ]}
                    >
                        <Text
                            style={[
                                styles.dayNumber,
                                { color: isSelected ? t.cardWhite : t.ink },
                            ]}
                        >
                            {item.date.getDate()}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        },
        [cycleLength, periodLength, t, effectiveSelected, onSelect],
    );

    // Initial scroll centers today.
    const onLayout = useCallback(() => {
        if (todayIdx > 0) {
            requestAnimationFrame(() => {
                listRef.current?.scrollToIndex({
                    index: todayIdx,
                    viewPosition: 0.5,
                    animated: !reduceMotion,
                });
            });
        }
    }, [todayIdx, reduceMotion]);

    return (
        <FlatList
            ref={listRef}
            data={cells}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item.dayIndex)}
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            initialScrollIndex={todayIdx}
            onLayout={onLayout}
            onScrollToIndexFailed={() => {
                // Cells are fixed-width; a rare failure just skips auto-centering.
            }}
            contentContainerStyle={styles.content}
            style={styles.list}
        />
    );
};

const styles = StyleSheet.create({
    list: {
        alignSelf: 'stretch',
    },
    content: {
        paddingHorizontal: 6,
        gap: CELL_GAP,
    },
    cell: {
        width: CELL_WIDTH,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    dow: {
        fontFamily: font(700),
        fontSize: 11,
        letterSpacing: 0.6,
    },
    numberWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayNumber: {
        fontFamily: font(800),
        fontSize: 16,
        letterSpacing: -0.2,
    },
});
