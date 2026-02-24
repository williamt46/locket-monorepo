import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { BlinkingHalo } from './BlinkingHalo';

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
    year: number;
    monthIndex: number; // 0-11
    data: Record<string, { isPeriod: boolean; isStart?: boolean; isEnd?: boolean; note?: string }>; // key: "monthIndex-day"
    futureData?: Record<string, boolean>; // Mock predictions
    onToggle?: (day: number) => void;
    interactive?: boolean;
    compact?: boolean; // For Yearly View
    isCurrentMonth?: boolean; // To check against system date
}

export const MonthGrid: React.FC<Props> = ({
    year,
    monthIndex,
    data,
    futureData = {},
    onToggle,
    interactive = true,
    compact = false,
    isCurrentMonth = false
}) => {
    // Calendar Logic
    const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
    const getStartDay = (month: number, year: number) => new Date(year, month, 1).getDay();

    const totalDays = getDaysInMonth(monthIndex, year);
    const startDay = getStartDay(monthIndex, year);
    const blanks = Array.from({ length: startDay }, (_, i) => i);
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);

    // Current Date Check
    const today = new Date();
    const currentDay = today.getDate();
    const isActuallyCurrentMonth = isCurrentMonth &&
        today.getFullYear() === year &&
        today.getMonth() === monthIndex;

    // Dynamic Sizing
    const screenWidth = Dimensions.get('window').width;
    // Compact: 3 columns in yearly view -> ~1/3 width minus margins
    // Full: ~90% width
    const containerWidth = compact ? (screenWidth / 3) - 16 : screenWidth * 0.9;
    const cellSize = Math.floor(containerWidth / 7);
    const dayFontSize = compact ? 8 : 14;
    const headerFontSize = compact ? 8 : 12;

    const renderCell = (day: number) => {
        // Fix collision: Include year in key
        const key = `${year}-${monthIndex}-${day}`;
        const dayData = data[key]; // Now potentially an object or undefined
        const isStamped = dayData?.isPeriod;

        // Future/Prediction logic remains same (mock keys should match)
        const isFuture = futureData[key];
        const isToday = isActuallyCurrentMonth && day === currentDay;

        // Styles
        let cellBackgroundColor = 'transparent';
        let opacity = 1;

        if (isStamped) {
            cellBackgroundColor = colors.inkBlue;
        } else if (isFuture) {
            cellBackgroundColor = colors.watermark;
            opacity = 0.6;
        }

        const cellStyle = [
            styles.cell,
            {
                width: cellSize,
                height: cellSize,
                borderRadius: cellSize / 2,
                backgroundColor: cellBackgroundColor,
                opacity
            },
        ];

        // Text Styles
        const textStyle = [
            styles.dayText,
            { fontSize: dayFontSize },
            isStamped && styles.dayTextStamped,
            isFuture && styles.dayTextFuture,
            isToday && !isStamped && styles.dayTextToday // Only color text if not stamped
        ];

        if (!interactive) {
            return (
                <View key={day} style={styles.dateContainer}>
                    {isToday && <BlinkingHalo size={cellSize} />}
                    <View style={cellStyle}>
                        <Text style={textStyle}>
                            {day}
                        </Text>
                    </View>
                </View>
            );
        }

        return (
            <TouchableOpacity
                key={day}
                style={styles.dateContainer}
                onPress={() => {
                    if (onToggle) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onToggle(day);
                    }
                }}
            >
                {isToday && <BlinkingHalo size={cellSize} />}
                <View style={cellStyle}>
                    <Text style={textStyle}>
                        {day}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { width: containerWidth }]}>
            {/* Week Header */}
            <View style={styles.headerRow}>
                {DAYS_OF_WEEK.map((d, i) => (
                    <View key={i} style={[styles.headerCell, { width: cellSize }]}>
                        <Text style={[styles.headerText, { fontSize: headerFontSize }]}>{d}</Text>
                    </View>
                ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.grid}>
                {blanks.map((b) => (
                    // Empty slots for start offset
                    <View key={`blank-${b}`} style={{ width: cellSize, height: cellSize }} />
                ))}
                {days.map((d) => renderCell(d))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignSelf: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        marginBottom: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.inkBlue,
        paddingBottom: 4,
        opacity: 0.6,
    },
    headerCell: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        fontFamily: typography.heading,
        color: colors.charcoal,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    cell: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    cellStamped: {
        backgroundColor: colors.inkBlue,
    },
    dayText: {
        fontFamily: typography.body,
        color: colors.charcoal,
    },
    dayTextStamped: {
        color: colors.paper,
        fontWeight: 'bold',
    },
    dayTextFuture: {
        color: colors.graphite, // Darker text on light watermark
        fontStyle: 'italic',
    },
    dayTextToday: {
        fontWeight: 'bold',
        color: colors.graphite,
    },
});
