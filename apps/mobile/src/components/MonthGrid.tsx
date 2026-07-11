import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
    year: number;
    monthIndex: number; // 0-11
    data: Record<string, { isPeriod: boolean; isStart?: boolean; isEnd?: boolean; note?: string; flow?: number; temperature?: { value: number; unit: 'F' | 'C' } | null; unmapped?: any; symptoms?: any[]; bleeding?: any }>; // key: "year-monthIndex-day" (this month's slice only)
    futureData?: Record<string, boolean>; // Predictions (this month's slice only)
    /**
     * Stable toggle callback keyed by full date coordinates. Passing month
     * coords through here (rather than an inline `(day) => ...` arrow per
     * render) is what lets React.memo skip off-screen months.
     */
    onToggleDate?: (year: number, monthIndex: number, day: number) => void;
    cellSize: number;
    /**
     * Today as "year-monthIndex-day" (0-indexed month). Passing it as a prop
     * (rather than reading new Date() only in render) lets the memoized grid
     * re-render when the calendar day actually changes — e.g. the parent bumps
     * it on app foreground so the "today" ring doesn't stick on yesterday across
     * midnight. Also the reference point for the no-future-logging guard.
     */
    todayKey?: string;
}

/**
 * Design-system month grid: period days render as solid menstrual-red circles,
 * predicted future days get a watermark fill, today gets a locket-blue ring.
 *
 * Wrapped in React.memo (see export below): receives only its own month's
 * pre-bucketed data/future slices plus a stable `onToggleDate`, so a toggle on
 * one day re-renders only the affected month rather than every mounted month.
 */
const MonthGridComponent: React.FC<Props> = ({
    year,
    monthIndex,
    data,
    futureData = {},
    onToggleDate,
    cellSize,
    todayKey,
}) => {
    const { t } = useTheme();

    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const startDay = new Date(year, monthIndex, 1).getDay();
    const blanks = Array.from({ length: startDay }, (_, i) => i);
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);

    // Parse today from the prop (falls back to now); "year-monthIndex-day".
    const [ty, tm, td] = todayKey
        ? todayKey.split('-').map(Number)
        : (() => {
            const n = new Date();
            return [n.getFullYear(), n.getMonth(), n.getDate()];
        })();
    const isCurrentMonth = ty === year && tm === monthIndex;
    const currentDay = td;
    const todayTime = new Date(ty, tm, td).getTime();

    const renderCell = (day: number) => {
        const key = `${year}-${monthIndex}-${day}`;
        const dayData = data[key];
        const isPeriod = !!dayData?.isPeriod;
        const hasSymptoms = !!(dayData && Array.isArray(dayData.symptoms) && dayData.symptoms.length > 0);
        const hasBleeding = !!(dayData && dayData.bleeding != null);
        const hasOtherData = !isPeriod && dayData && (dayData.flow === 0 || dayData.note || dayData.temperature != null || (dayData.unmapped && Object.keys(dayData.unmapped).length > 0) || hasSymptoms || hasBleeding);
        const hasNotesWhenPeriod = isPeriod && dayData && (dayData.note || (dayData.unmapped && Object.keys(dayData.unmapped).length > 0) || dayData.temperature != null || hasSymptoms || hasBleeding);

        const isFuture = futureData[key];
        const isToday = isCurrentMonth && day === currentDay;
        // A calendar date after today can't be logged (distinct from `isFuture`,
        // which is a *prediction* watermark). Such cells are non-interactive.
        const isFutureCalendar = new Date(year, monthIndex, day).getTime() > todayTime;

        let backgroundColor = 'transparent';
        let textColor = t.charcoal;
        let borderWidth = 0;
        let borderColor = 'transparent';
        let weight: 400 | 600 | 700 = 400;

        if (isPeriod) {
            backgroundColor = t.menstrual;
            textColor = t.onAccent;
            weight = 600;
        } else if (isFuture) {
            backgroundColor = t.watermark;
            textColor = t.graphite;
        }
        if (isToday && !isPeriod) {
            borderWidth = 2;
            borderColor = t.locketBlue;
            textColor = t.locketBlue;
            weight = 600;
        }
        // Non-predicted future days read as inactive (muted, not loggable).
        if (isFutureCalendar && !isFuture) {
            textColor = t.whisper;
        }

        const inner = (
            <>
                <View
                    style={{
                        width: cellSize - 6,
                        height: cellSize - 6,
                        borderRadius: (cellSize - 6) / 2,
                        backgroundColor,
                        borderWidth,
                        borderColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text style={{ fontFamily: font(weight), fontSize: 14, color: textColor }}>{day}</Text>
                </View>
                {(hasOtherData || hasNotesWhenPeriod) && (
                    <View style={styles.dotWrap} pointerEvents="none">
                        <View style={[styles.dot, { backgroundColor: t.gold }]} />
                    </View>
                )}
            </>
        );

        // Read-only when there's no toggle handler, or the day is in the future
        // (future dates can't be logged).
        if (!onToggleDate || isFutureCalendar) {
            return (
                <View
                    key={day}
                    style={[styles.dateContainer, { width: cellSize, height: cellSize }]}
                    accessibilityElementsHidden={isFutureCalendar}
                >
                    {inner}
                </View>
            );
        }

        return (
            <TouchableOpacity
                key={day}
                style={[styles.dateContainer, { width: cellSize, height: cellSize }]}
                accessibilityRole="button"
                accessibilityLabel={`Day ${day}`}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onToggleDate(year, monthIndex, day);
                }}
            >
                {inner}
            </TouchableOpacity>
        );
    };

    return (
        <View>
            {/* Week header */}
            <View style={styles.headerRow}>
                {DAYS_OF_WEEK.map((d, i) => (
                    <View key={i} style={[styles.headerCell, { width: cellSize }]}>
                        <Text style={{ fontFamily: font(600), fontSize: 12, color: t.fog }}>{d}</Text>
                    </View>
                ))}
            </View>

            {/* Grid */}
            <View style={styles.grid}>
                {blanks.map((b) => (
                    <View key={`blank-${b}`} style={{ width: cellSize, height: cellSize }} />
                ))}
                {days.map((d) => renderCell(d))}
            </View>
        </View>
    );
};

/**
 * Memoized so off-screen months in the (potentially 20-year) FlatList never
 * re-render on an unrelated day toggle. Relies on the parent passing stable
 * per-month slice references (empty months share one frozen EMPTY object) and a
 * stable `onToggleDate` — an inline arrow prop would defeat this entirely.
 */
export const MonthGrid = React.memo(MonthGridComponent);
MonthGrid.displayName = 'MonthGrid';

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    headerCell: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotWrap: {
        // The day circle is inset 3px from the cell edge; sit the marker ~4px
        // above the circle's bottom edge so it reads comfortably inside the
        // circle on period days rather than touching (and looking clipped at) it.
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 7,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
});
