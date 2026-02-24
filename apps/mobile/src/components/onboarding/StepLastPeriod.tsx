import React, { useCallback, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';

// ── Props ───────────────────────────────────────────────────────────

interface StepLastPeriodProps {
    /** Currently selected date "YYYY-MM-DD" */
    value: string;
    /** Called with the newly selected date string */
    onChange: (date: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Generate an array of the last N days as "YYYY-MM-DD" strings. */
function generateRecentDates(count: number): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
}

/** Format "YYYY-MM-DD" → "Mon DD" (e.g. "Feb 24") for display. */
function formatShort(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Format "YYYY-MM-DD" → "Weekday" (e.g. "Monday"). */
function formatWeekday(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getUTCDay()];
}

// ── Item height for getItemLayout optimization ──────────────────────
const ITEM_HEIGHT = 64;

// ── Component ───────────────────────────────────────────────────────

/**
 * StepLastPeriod — Date picker for last period start.
 * Shows a scrollable flat list of the last 60 days.
 * Avoids adding an external calendar dependency.
 */
export const StepLastPeriod: React.FC<StepLastPeriodProps> = ({
    value,
    onChange,
}) => {
    const dates = useMemo(() => generateRecentDates(60), []);

    const renderItem = useCallback(
        ({ item }: { item: string }) => {
            const selected = item === value;
            return (
                <TouchableOpacity
                    onPress={() => onChange(item)}
                    style={[styles.dateRow, selected && styles.dateRowSelected]}
                    activeOpacity={0.7}
                    accessibilityLabel={`Select ${formatShort(item)}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                >
                    <Text style={[styles.weekday, selected && styles.textSelected]}>
                        {formatWeekday(item)}
                    </Text>
                    <Text style={[styles.dateText, selected && styles.textSelected]}>
                        {formatShort(item)}
                    </Text>
                    {item === dates[0] && (
                        <Text style={[styles.todayBadge, selected && styles.textSelected]}>
                            Today
                        </Text>
                    )}
                </TouchableOpacity>
            );
        },
        [value, onChange, dates],
    );

    const keyExtractor = useCallback((item: string) => item, []);

    const getItemLayout = useCallback(
        (_: any, index: number) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
        }),
        [],
    );

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>When did your last period start?</Text>
            <Text style={styles.subheading}>
                Select the first day of your most recent period.
            </Text>

            <FlatList
                data={dates}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                getItemLayout={getItemLayout}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                windowSize={5}
            />
        </View>
    );
};

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: layout.spacing.m,
    },
    heading: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.h2,
        color: colors.charcoal,
        textAlign: 'center',
        marginBottom: layout.spacing.s,
    },
    subheading: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
        color: colors.graphite,
        textAlign: 'center',
        marginBottom: layout.spacing.l,
    },
    list: {
        flex: 1,
    },
    dateRow: {
        height: ITEM_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: layout.spacing.m,
        borderRadius: layout.borderRadius.m,
        marginBottom: layout.spacing.xs,
        backgroundColor: 'transparent',
    },
    dateRowSelected: {
        backgroundColor: colors.inkBlue,
    },
    weekday: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
        color: colors.graphite,
        width: 40,
    },
    dateText: {
        flex: 1,
        fontFamily: typography.heading,
        fontSize: typography.sizes.body,
        color: colors.charcoal,
        marginLeft: layout.spacing.m,
    },
    textSelected: {
        color: colors.paper,
    },
    todayBadge: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        color: colors.gold,
        fontStyle: 'italic',
    },
});
