import React, { useMemo, useRef, useImperativeHandle, forwardRef, useCallback, useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, Dimensions, AppState } from 'react-native';
import { MonthGrid } from './MonthGrid';
import { Card } from './DesignSystem';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';
import { deriveCalendarRange, MonthRef } from '../utils/calendarRange';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// One continuous vertical scroll of months (design-system Ledger pattern).
// The visible range is data-derived (see deriveCalendarRange): earliest logged
// month with a 24-month floor / 20-year cap → one month past the last predicted
// period. No fixed window constants.

// Shared frozen empties so months with no data/predictions pass a *stable*
// reference into the memoized MonthGrid and never re-render.
const EMPTY_DATA: Record<string, any> = Object.freeze({});
const EMPTY_FUTURE: Record<string, boolean> = Object.freeze({});

// Bucket a "YYYY-M-D"-keyed map into per-month sub-maps keyed "YYYY-M".
// Each bucket keeps the original full day keys, so MonthGrid still indexes by
// `${year}-${monthIndex}-${day}` unchanged.
function bucketByMonth<V>(map: Record<string, V>): Record<string, Record<string, V>> {
    const buckets: Record<string, Record<string, V>> = {};
    for (const key in map) {
        const first = key.indexOf('-');
        if (first < 0) continue;
        const second = key.indexOf('-', first + 1);
        if (second < 0) continue;
        const monthKey = key.slice(0, second);
        (buckets[monthKey] ??= {})[key] = map[key];
    }
    return buckets;
}

// Today as "year-monthIndex-day" (0-indexed month, matching the data-key/grid
// coordinate format MonthGrid indexes by).
const makeTodayKey = (d: Date = new Date()) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

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

        // Recompute "today" when the app returns to foreground so the today ring
        // and the no-future-logging guard don't stick on a stale day across
        // midnight. Only re-renders the grids when the day actually changed.
        const [todayKey, setTodayKey] = useState(makeTodayKey);
        useEffect(() => {
            const sub = AppState.addEventListener('change', (state) => {
                if (state === 'active') {
                    const next = makeTodayKey();
                    setTodayKey((prev) => (prev === next ? prev : next));
                }
            });
            return () => sub.remove();
        }, []);

        // Data-derived month range (replaces the fixed −24/+3 window).
        const months = useMemo<MonthRef[]>(
            () => deriveCalendarRange(Object.keys(data), Object.keys(futureData ?? {}), new Date()),
            [data, futureData]
        );

        // Index of the current month within the derived range — the calendar
        // opens here and the Today pill scrolls back to it.
        const todayIndex = useMemo(() => {
            const now = new Date();
            const idx = months.findIndex(
                (m) => m.year === now.getFullYear() && m.monthIndex === now.getMonth()
            );
            return idx >= 0 ? idx : Math.max(0, months.length - 1);
        }, [months]);

        // Pre-bucket both maps by "year-monthIndex" once per data change so each
        // MonthGrid receives only its own slice (stable ref → memo holds).
        const dataByMonth = useMemo(() => bucketByMonth(data), [data]);
        const futureByMonth = useMemo(() => bucketByMonth(futureData ?? {}), [futureData]);

        const indexOfDate = useCallback(
            (date: Date) => {
                const idx = months.findIndex(
                    (m) => m.year === date.getFullYear() && m.monthIndex === date.getMonth()
                );
                return idx >= 0 ? idx : todayIndex;
            },
            [months, todayIndex]
        );

        useImperativeHandle(ref, () => ({
            scrollToDate: (date: Date, animated = true) => {
                listRef.current?.scrollToIndex({ index: indexOfDate(date), animated, viewPosition: 0.15 });
            },
            scrollToToday: () => {
                listRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.15 });
            },
        }));

        const renderItem = ({ item }: { item: MonthRef }) => {
            const monthKey = `${item.year}-${item.monthIndex}`;
            return (
                <View style={{ height: ITEM_HEIGHT }}>
                    <View style={styles.titleBlock}>
                        <Text style={[styles.monthTitle, { color: t.ink }]}>{MONTH_NAMES[item.monthIndex]}</Text>
                        <Text style={[styles.yearTitle, { color: t.fog }]}>{item.year}</Text>
                    </View>
                    <Card padding={CARD_PADDING}>
                        <MonthGrid
                            year={item.year}
                            monthIndex={item.monthIndex}
                            data={dataByMonth[monthKey] ?? EMPTY_DATA}
                            futureData={futureByMonth[monthKey] ?? EMPTY_FUTURE}
                            onToggleDate={onToggleDate}
                            cellSize={CELL_SIZE}
                            todayKey={todayKey}
                        />
                    </Card>
                </View>
            );
        };

        return (
            <FlatList
                ref={listRef}
                data={months}
                renderItem={renderItem}
                keyExtractor={(m) => `${m.year}-${m.monthIndex}`}
                showsVerticalScrollIndicator={false}
                extraData={todayKey}
                initialScrollIndex={todayIndex}
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
