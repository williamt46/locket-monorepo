import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';
import { RecentDatePicker } from '../RecentDatePicker';

// ── Props ───────────────────────────────────────────────────────────

interface StepLastPeriodProps {
    /** Currently selected date "YYYY-MM-DD" (empty string when unknown) */
    value: string;
    /** Called with the newly selected date string */
    onChange: (date: string) => void;
    /** When true, the date is "unknown" (estimated) — dim the list (T7/§4). */
    dimmed?: boolean;
}

// ── Component ───────────────────────────────────────────────────────

/**
 * StepLastPeriod — Date picker for last period start. Renders the shared
 * bounded RecentDatePicker (today back to 280 days ago); no future dates.
 */
export const StepLastPeriod: React.FC<StepLastPeriodProps> = ({
    value,
    onChange,
    dimmed = false,
}) => {
    const { t } = useTheme();

    return (
        <View style={styles.container}>
            <Text style={[styles.heading, { color: t.ink }]}>
                When did your last period start?
            </Text>
            <Text style={[styles.subheading, { color: t.fog }]}>
                Select the first day of your most recent period.
            </Text>

            <RecentDatePicker value={value} onChange={onChange} dimmed={dimmed} />
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
        textAlign: 'center',
        marginBottom: layout.spacing.s,
    },
    subheading: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
        textAlign: 'center',
        marginBottom: layout.spacing.l,
    },
});
