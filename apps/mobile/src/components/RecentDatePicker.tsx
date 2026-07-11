import React, { useCallback, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    ViewStyle,
    StyleProp,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { layout } from '../theme/layout';
import { RECENT_DAYS, recentDateStrings } from '../utils/recentDates';

/**
 * Bounded "recent days" date picker shared by onboarding (last-period step) and
 * the Settings baseline editor. Selectable range is **today back to
 * `RECENT_DAYS - 1` days ago** — no future dates, capped depth. Avoids adding a
 * native calendar dependency. The range math lives in utils/recentDates (pure,
 * tested); this component is the RN presentation.
 */
export { RECENT_DAYS };

const ITEM_HEIGHT = 64;

/** Format "YYYY-MM-DD" → "Mon DD" (e.g. "Feb 24"). tz-neutral (calendar date). */
function formatShort(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Format "YYYY-MM-DD" → short weekday (e.g. "Mon"). */
function formatWeekday(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getUTCDay()];
}

interface RecentDatePickerProps {
    /** Selected date "YYYY-MM-DD" ('' when none/unknown). */
    value: string;
    onChange: (date: string) => void;
    /** Dim the list (the "I'm not sure"/estimated state). */
    dimmed?: boolean;
    /** How many days back to offer (default RECENT_DAYS). */
    days?: number;
    style?: StyleProp<ViewStyle>;
}

export const RecentDatePicker: React.FC<RecentDatePickerProps> = ({
    value,
    onChange,
    dimmed = false,
    days = RECENT_DAYS,
    style,
}) => {
    const { t } = useTheme();
    const dates = useMemo(() => recentDateStrings(days), [days]);
    const selectedIndex = useMemo(() => dates.indexOf(value), [dates, value]);

    const renderItem = useCallback(
        ({ item }: { item: string }) => {
            const selected = item === value;
            return (
                <TouchableOpacity
                    onPress={() => onChange(item)}
                    style={[styles.dateRow, selected && { backgroundColor: t.locketBlue }]}
                    activeOpacity={0.7}
                    accessibilityLabel={`Select ${formatShort(item)}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                >
                    <Text style={[styles.weekday, { color: selected ? t.onAccent : t.fog }]}>
                        {formatWeekday(item)}
                    </Text>
                    <Text style={[styles.dateText, { color: selected ? t.onAccent : t.ink }]}>
                        {formatShort(item)}
                    </Text>
                    {item === dates[0] && (
                        <Text style={[styles.todayBadge, { color: selected ? t.onAccent : t.gold }]}>
                            Today
                        </Text>
                    )}
                </TouchableOpacity>
            );
        },
        [value, onChange, dates, t],
    );

    const getItemLayout = useCallback(
        (_: any, index: number) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }),
        [],
    );

    return (
        <FlatList
            data={dates}
            renderItem={renderItem}
            keyExtractor={(item) => item}
            getItemLayout={getItemLayout}
            style={[styles.list, dimmed && styles.dimmed, style]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            windowSize={5}
            initialScrollIndex={selectedIndex > 0 ? selectedIndex : undefined}
            onScrollToIndexFailed={() => { /* bounded list; ignore */ }}
        />
    );
};

const styles = StyleSheet.create({
    list: {
        flex: 1,
    },
    dimmed: {
        opacity: 0.4,
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
    weekday: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
        width: 40,
    },
    dateText: {
        flex: 1,
        fontFamily: typography.heading,
        fontSize: typography.sizes.body,
        marginLeft: layout.spacing.m,
    },
    todayBadge: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        fontStyle: 'italic',
    },
});
