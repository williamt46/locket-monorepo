import React, { useMemo, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, Dimensions } from 'react-native';
import { MonthGrid } from './MonthGrid';
import { Card } from './DesignSystem';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// One continuous vertical scroll of months (design-system Ledger pattern).
// Window: MONTHS_BACK before the current month through MONTHS_FORWARD after,
// covering logged history and the 3-cycle prediction horizon.
const MONTHS_BACK = 24;
const MONTHS_FORWARD = 3;

const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PADDING = 20;   // list horizontal padding
const CARD_PADDING = 16;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - CARD_PADDING * 2) / 7);
// Fixed item height keeps getItemLayout exact so scrollToIndex never misses:
// title block + week header + always 6 grid rows + margins.
const TITLE_BLOCK = 64;
const WEEK_HEADER = 27;
const GRID_HEIGHT = CELL_SIZE * 6;
const MONTH_MARGIN = 28;
const ITEM_HEIGHT = TITLE_BLOCK + CARD_PADDING * 2 + WEEK_HEADER + GRID_HEIGHT + MONTH_MARGIN;

interface MonthRef {
    year: number;
    monthIndex: number;
}

interface VerticalCalendarProps {
    data: Record<string, any>;
    futureData?: Record<string, boolean>;
    onToggleDate: (year: number, monthIndex: number, day: number) => void;
}

export interface VerticalCalendarHandle {
    scrollToDate: (date: Date, animated?: boolean) => void;
    scrollToToday: () => void;
}

export const VerticalCalendar = forwardRef<VerticalCalendarHandle, VerticalCalendarProps>(
    ({ data, futureData, onToggleDate }, ref) => {
        const { t } = useTheme();
        const listRef = useRef<FlatList<MonthRef>>(null);

        const months = useMemo<MonthRef[]>(() => {
            const now = new Date();
            const list: MonthRef[] = [];
            for (let offset = -MONTHS_BACK; offset <= MONTHS_FORWARD; offset++) {
                const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                list.push({ year: d.getFullYear(), monthIndex: d.getMonth() });
            }
            return list;
        }, []);

        const indexOfDate = useCallback(
            (date: Date) => {
                const idx = months.findIndex(
                    (m) => m.year === date.getFullYear() && m.monthIndex === date.getMonth()
                );
                return idx >= 0 ? idx : MONTHS_BACK;
            },
            [months]
        );

        useImperativeHandle(ref, () => ({
            scrollToDate: (date: Date, animated = true) => {
                listRef.current?.scrollToIndex({ index: indexOfDate(date), animated, viewPosition: 0.15 });
            },
            scrollToToday: () => {
                listRef.current?.scrollToIndex({ index: MONTHS_BACK, animated: true, viewPosition: 0.15 });
            },
        }));

        const renderItem = ({ item }: { item: MonthRef }) => (
            <View style={{ height: ITEM_HEIGHT }}>
                <View style={styles.titleBlock}>
                    <Text style={[styles.monthTitle, { color: t.ink }]}>{MONTH_NAMES[item.monthIndex]}</Text>
                    <Text style={[styles.yearTitle, { color: t.fog }]}>{item.year}</Text>
                </View>
                <Card padding={CARD_PADDING}>
                    <MonthGrid
                        year={item.year}
                        monthIndex={item.monthIndex}
                        data={data}
                        futureData={futureData}
                        onToggle={(day) => onToggleDate(item.year, item.monthIndex, day)}
                        cellSize={CELL_SIZE}
                    />
                </Card>
            </View>
        );

        return (
            <FlatList
                ref={listRef}
                data={months}
                extraData={data}
                renderItem={renderItem}
                keyExtractor={(m) => `${m.year}-${m.monthIndex}`}
                showsVerticalScrollIndicator={false}
                initialScrollIndex={MONTHS_BACK}
                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingTop: 8, paddingBottom: 64 }}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        listRef.current?.scrollToIndex({ index: info.index, animated: false });
                    }, 300);
                }}
            />
        );
    }
);

VerticalCalendar.displayName = 'VerticalCalendar';

const styles = StyleSheet.create({
    titleBlock: {
        alignItems: 'center',
        height: TITLE_BLOCK,
        justifyContent: 'center',
    },
    monthTitle: {
        fontFamily: font(700),
        fontSize: 22,
        letterSpacing: -0.2,
    },
    yearTitle: {
        fontFamily: font(400),
        fontSize: 13,
        marginTop: 2,
    },
});
