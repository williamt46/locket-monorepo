import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Days in each month (Non-leap year default)
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Interfaces for Cycle Data
interface CycleData {
    [key: string]: boolean; // format "monthIndex-dayIndex": true/false
}

interface Props {
    year: number;
    data: Record<string, boolean>;
    onToggle: (monthIndex: number, day: number) => void;
}

export const WinslowGrid: React.FC<Props> = ({ year, data, onToggle }) => {
    // Responsive sizing
    const screenWidth = Dimensions.get('window').width;
    // Use most of the screen width now that symptoms are gone
    const availableWidth = screenWidth * 0.9 - 30;
    const calculatedSize = Math.floor(availableWidth / 13);

    // Cap max size, but allow shrinking
    const CELL_SIZE = Math.min(26, calculatedSize); // Slightly larger max size
    const GAP = 4; // Restored gap comfortably

    return (
        <View style={styles.container}>
            {/* Header Row: Months */}
            <View style={styles.headerRow}>
                <View style={[styles.dayLabelPlaceholder, { width: 20 }]} />
                {MONTHS.map((m, i) => (
                    <View key={`head-${i}`} style={{ width: CELL_SIZE, marginHorizontal: GAP / 2, alignItems: 'center' }}>
                        <Text style={styles.headerText}>{m}</Text>
                    </View>
                ))}
            </View>

            {/* Grid Rows */}
            {DAYS.map((day) => (
                <View key={`row-${day}`} style={styles.row}>
                    {/* Day Label */}
                    <View style={[styles.dayLabelContainer, { width: 20 }]}>
                        {/* Show label only every 5 days or 1st/Last to reduce clutter? User image has all. Keep all. */}
                        <Text style={styles.dayLabel}>{day}</Text>
                    </View>

                    {/* Month Cells for this Day */}
                    {MONTHS.map((_, mouthIdx) => {
                        const isValidDay = day <= DAYS_IN_MONTH[mouthIdx];
                        if (!isValidDay) {
                            return <View key={`cell-${mouthIdx}-${day}`} style={{ width: CELL_SIZE, marginHorizontal: GAP / 2 }} />;
                        }

                        const isStamped = data[`${mouthIdx}-${day}`];
                        return (
                            <TouchableOpacity
                                key={`cell-${mouthIdx}-${day}`}
                                style={{ marginHorizontal: GAP / 2 }}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onToggle(mouthIdx, day);
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={[
                                    styles.cellBase,
                                    { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2 },
                                    isStamped ? styles.cellStamped : styles.cellEmpty
                                ]} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    dayLabelPlaceholder: {
        marginRight: 4,
    },
    colHeader: {
        alignItems: 'center',
    },
    headerText: {
        fontFamily: typography.serif,
        fontSize: 12,
        color: colors.ink,
        opacity: 0.8,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 2, // Tighter rows
        alignItems: 'center',
    },
    dayLabelContainer: {
        marginRight: 4,
        alignItems: 'flex-end',
    },
    dayLabel: {
        fontFamily: typography.sans,
        fontSize: 9, // Smaller font
        color: colors.secondary,
    },
    cellContainer: {
    },
    cellBase: {
        borderWidth: 0.5, // Thinner lines
    },
    cellEmpty: {
        borderColor: colors.ink,
        opacity: 0.3, // "Paper" empty circle look
        backgroundColor: 'transparent',
    },
    cellStamped: {
        backgroundColor: colors.primary, // Ink fill
        borderColor: colors.primary,
        opacity: 0.9,
    },
});
