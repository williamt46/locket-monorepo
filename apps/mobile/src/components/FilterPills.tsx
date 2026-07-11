import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
} from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

// ─── Filter model ────────────────────────────────────────────────────────────

export type FilterKind = 'all' | '3mo' | '6mo' | '1yr' | 'since';

export interface FilterValue {
    kind: FilterKind;
    /** First day of the chosen month; only set when kind === 'since'. */
    sinceDate?: Date;
}

export const DEFAULT_FILTER: FilterValue = { kind: 'all' };

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Inclusive lower bound to pass to buildCycleHistory for a given filter. `null`
 * for All (no window). Relative filters count back from `today`; Since uses the
 * chosen month's first day.
 */
export function windowStartFor(value: FilterValue, today: Date = new Date()): Date | null {
    switch (value.kind) {
        case 'all':
            return null;
        case '3mo':
            return monthsBack(today, 3);
        case '6mo':
            return monthsBack(today, 6);
        case '1yr':
            return monthsBack(today, 12);
        case 'since':
            return value.sinceDate ?? null;
    }
}

function monthsBack(today: Date, n: number): Date {
    const d = new Date(today.getFullYear(), today.getMonth() - n, today.getDate());
    d.setHours(0, 0, 0, 0);
    return d;
}

/** "Since Mar 2024" label for an active Since pill. */
export function sinceLabel(date: Date): string {
    return `Since ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FilterPillsProps {
    value: FilterValue;
    onChange: (value: FilterValue) => void;
    /** Earliest logged period day — lower bound of the Since picker. */
    earliest: Date | null;
    today?: Date;
}

const RELATIVE: Array<{ kind: FilterKind; label: string }> = [
    { kind: 'all', label: 'All' },
    { kind: '3mo', label: '3 mo' },
    { kind: '6mo', label: '6 mo' },
    { kind: '1yr', label: '1 yr' },
];

export const FilterPills: React.FC<FilterPillsProps> = ({ value, onChange, earliest, today = new Date() }) => {
    const { t } = useTheme();
    const [pickerOpen, setPickerOpen] = useState(false);

    const sinceActive = value.kind === 'since' && value.sinceDate != null;

    return (
        <View style={styles.row}>
            {RELATIVE.map((opt) => {
                const selected = value.kind === opt.kind;
                return (
                    <Pill
                        key={opt.kind}
                        label={opt.label}
                        selected={selected}
                        onPress={() => onChange({ kind: opt.kind })}
                    />
                );
            })}

            {sinceActive ? (
                <TouchableOpacity
                    style={[styles.pill, { backgroundColor: t.locketBlue }]}
                    onPress={() => onChange(DEFAULT_FILTER)}
                    accessibilityRole="button"
                    accessibilityLabel={`${sinceLabel(value.sinceDate!)}, tap to clear`}
                    accessibilityState={{ selected: true }}
                >
                    <Text style={[styles.pillLabel, { color: t.cardWhite }]}>
                        {sinceLabel(value.sinceDate!)}
                    </Text>
                    <Icon name="close" size={13} color={t.cardWhite} />
                </TouchableOpacity>
            ) : (
                <Pill
                    label="Since…"
                    selected={false}
                    onPress={() => setPickerOpen(true)}
                />
            )}

            <MonthPicker
                visible={pickerOpen}
                earliest={earliest}
                today={today}
                initial={value.kind === 'since' ? value.sinceDate : undefined}
                onClose={() => setPickerOpen(false)}
                onSelect={(d) => {
                    setPickerOpen(false);
                    onChange({ kind: 'since', sinceDate: d });
                }}
            />
        </View>
    );
};

const Pill: React.FC<{ label: string; selected: boolean; onPress: () => void }> = ({
    label,
    selected,
    onPress,
}) => {
    const { t } = useTheme();
    return (
        <TouchableOpacity
            style={[
                styles.pill,
                selected
                    ? { backgroundColor: t.locketBlue }
                    : { backgroundColor: t.cardWhite, borderWidth: 1, borderColor: t.divider },
            ]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
        >
            <Text style={[styles.pillLabel, { color: selected ? t.cardWhite : t.ink }]}>{label}</Text>
        </TouchableOpacity>
    );
};

// ─── Month/year picker ────────────────────────────────────────────────────────

/**
 * Two-column month/year wheel bounded to [earliest logged month, current month].
 * Selecting a month emits its first day. Falls back to the current month as the
 * lower bound when nothing is logged yet.
 */
const MonthPicker: React.FC<{
    visible: boolean;
    earliest: Date | null;
    today: Date;
    initial?: Date;
    onClose: () => void;
    onSelect: (date: Date) => void;
}> = ({ visible, earliest, today, initial, onClose, onSelect }) => {
    const { t } = useTheme();

    const lower = earliest ?? new Date(today.getFullYear(), today.getMonth(), 1);
    const minYear = lower.getFullYear();
    const maxYear = today.getFullYear();

    const years = useMemo(() => {
        const out: number[] = [];
        for (let y = minYear; y <= maxYear; y++) out.push(y);
        return out;
    }, [minYear, maxYear]);

    const [year, setYear] = useState(
        initial ? initial.getFullYear() : maxYear,
    );
    const [month, setMonth] = useState(
        initial ? initial.getMonth() : today.getMonth(),
    );

    // Bound the selectable months for the chosen year.
    const monthEnabled = (m: number): boolean => {
        const first = new Date(year, m, 1);
        const lowerFirst = new Date(lower.getFullYear(), lower.getMonth(), 1);
        const upperFirst = new Date(today.getFullYear(), today.getMonth(), 1);
        return first.getTime() >= lowerFirst.getTime() && first.getTime() <= upperFirst.getTime();
    };

    const confirm = () => {
        if (!monthEnabled(month)) return;
        onSelect(new Date(year, month, 1));
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.sheet, { backgroundColor: t.cardWhite, shadowColor: t.shadowColor }]}>
                    <Text style={[styles.sheetTitle, { color: t.ink }]}>Since when?</Text>

                    <View style={styles.wheels}>
                        <ScrollView style={styles.wheelCol} showsVerticalScrollIndicator={false}>
                            {MONTHS.map((label, m) => {
                                const enabled = monthEnabled(m);
                                const selected = m === month;
                                return (
                                    <TouchableOpacity
                                        key={label}
                                        disabled={!enabled}
                                        onPress={() => setMonth(m)}
                                        style={styles.wheelRow}
                                        accessibilityState={{ selected, disabled: !enabled }}
                                    >
                                        <Text
                                            style={[
                                                styles.wheelText,
                                                {
                                                    color: !enabled ? t.divider : selected ? t.locketBlue : t.ink,
                                                    fontFamily: font(selected ? 700 : 500),
                                                },
                                            ]}
                                        >
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <ScrollView style={styles.wheelCol} showsVerticalScrollIndicator={false}>
                            {years.map((y) => {
                                const selected = y === year;
                                return (
                                    <TouchableOpacity
                                        key={y}
                                        onPress={() => setYear(y)}
                                        style={styles.wheelRow}
                                        accessibilityState={{ selected }}
                                    >
                                        <Text
                                            style={[
                                                styles.wheelText,
                                                {
                                                    color: selected ? t.locketBlue : t.ink,
                                                    fontFamily: font(selected ? 700 : 500),
                                                },
                                            ]}
                                        >
                                            {y}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.confirmBtn,
                            { backgroundColor: monthEnabled(month) ? t.locketBlue : t.divider },
                        ]}
                        onPress={confirm}
                        disabled={!monthEnabled(month)}
                        accessibilityRole="button"
                        accessibilityLabel="Apply since filter"
                    >
                        <Text style={[styles.confirmText, { color: monthEnabled(month) ? t.cardWhite : t.fog }]}>
                            Apply
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
                        <Text style={[styles.cancelText, { color: t.fog }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 36,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },
    pillLabel: {
        fontFamily: font(600),
        fontSize: 13,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    sheet: {
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 8,
    },
    sheetTitle: {
        fontFamily: font(700),
        fontSize: 19,
        textAlign: 'center',
        marginBottom: 16,
    },
    wheels: {
        flexDirection: 'row',
        gap: 16,
        height: 200,
        marginBottom: 16,
    },
    wheelCol: {
        flex: 1,
    },
    wheelRow: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wheelText: {
        fontSize: 17,
    },
    confirmBtn: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 6,
    },
    confirmText: {
        fontFamily: font(600),
        fontSize: 15,
    },
    cancelBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelText: {
        fontFamily: font(500),
        fontSize: 15,
    },
});
