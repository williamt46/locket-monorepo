import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
    year: number;
    monthIndex: number; // 0-11
    data: Record<string, { isPeriod: boolean; isStart?: boolean; isEnd?: boolean; note?: string; flow?: number; bbt?: number; unmapped?: any; symptoms?: any[]; bleeding?: any }>; // key: "year-monthIndex-day"
    futureData?: Record<string, boolean>; // Predictions
    onToggle?: (day: number) => void;
    cellSize: number;
}

/**
 * Design-system month grid: period days render as solid menstrual-red circles,
 * predicted future days get a watermark fill, today gets a locket-blue ring.
 */
export const MonthGrid: React.FC<Props> = ({
    year,
    monthIndex,
    data,
    futureData = {},
    onToggle,
    cellSize,
}) => {
    const { t } = useTheme();

    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const startDay = new Date(year, monthIndex, 1).getDay();
    const blanks = Array.from({ length: startDay }, (_, i) => i);
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
    const currentDay = today.getDate();

    const renderCell = (day: number) => {
        const key = `${year}-${monthIndex}-${day}`;
        const dayData = data[key];
        const isPeriod = !!dayData?.isPeriod;
        const hasSymptoms = !!(dayData && Array.isArray(dayData.symptoms) && dayData.symptoms.length > 0);
        const hasBleeding = !!(dayData && dayData.bleeding != null);
        const hasOtherData = !isPeriod && dayData && (dayData.flow === 0 || dayData.note || dayData.bbt !== undefined || (dayData.unmapped && Object.keys(dayData.unmapped).length > 0) || hasSymptoms || hasBleeding);
        const hasNotesWhenPeriod = isPeriod && dayData && (dayData.note || (dayData.unmapped && Object.keys(dayData.unmapped).length > 0) || dayData.bbt !== undefined || hasSymptoms || hasBleeding);

        const isFuture = futureData[key];
        const isToday = isCurrentMonth && day === currentDay;

        let backgroundColor = 'transparent';
        let textColor = t.charcoal;
        let borderWidth = 0;
        let borderColor = 'transparent';
        let weight: 400 | 600 | 700 = 400;

        if (isPeriod) {
            backgroundColor = t.menstrual;
            textColor = '#FFFFFF';
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

        if (!onToggle) {
            return (
                <View key={day} style={[styles.dateContainer, { width: cellSize, height: cellSize }]}>
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
                    onToggle(day);
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
