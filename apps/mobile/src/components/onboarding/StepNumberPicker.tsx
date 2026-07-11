import React, { useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';
import { clampValue } from '../../models/BaselineCycleData';

// ── Props ───────────────────────────────────────────────────────────

interface StepNumberPickerProps {
    /** Current numeric value */
    value: number;
    /** Callback when value changes */
    onChange: (next: number) => void;
    /** Minimum allowed value */
    min: number;
    /** Maximum allowed value */
    max: number;
    /** Label displayed above the picker */
    label: string;
    /** Unit label (e.g. "days") */
    unit: string;
    /** When true, the value is a typical/estimated default — dim the picker (T7/§4). */
    dimmed?: boolean;
}

// ── Component ───────────────────────────────────────────────────────

/**
 * A reusable chevron-based number picker with min/max clamping.
 * Touch targets are ≥ 48px for mobile accessibility.
 */
export const StepNumberPicker: React.FC<StepNumberPickerProps> = ({
    value,
    onChange,
    min,
    max,
    label,
    unit,
    dimmed = false,
}) => {
    const { t } = useTheme();

    const increment = useCallback(() => {
        onChange(clampValue(value + 1, min, max));
    }, [value, onChange, min, max]);

    const decrement = useCallback(() => {
        onChange(clampValue(value - 1, min, max));
    }, [value, onChange, min, max]);

    const atMin = value <= min;
    const atMax = value >= max;

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: t.ink }]}>{label}</Text>

            <View style={[styles.pickerRow, dimmed && styles.dimmed]}>
                <TouchableOpacity
                    onPress={decrement}
                    disabled={atMin}
                    style={[
                        styles.chevronButton,
                        { backgroundColor: t.paleLavender },
                        atMin && styles.chevronDisabled,
                    ]}
                    hitSlop={layout.hitSlop}
                    accessibilityLabel={`Decrease ${label}`}
                    accessibilityRole="button"
                >
                    <Text style={[styles.chevron, { color: atMin ? t.fog : t.ink }]}>▼</Text>
                </TouchableOpacity>

                <View style={styles.valueContainer}>
                    <Text style={[styles.value, { color: t.locketBlue }]}>{value}</Text>
                    <Text style={[styles.unit, { color: t.fog }]}>{unit}</Text>
                </View>

                <TouchableOpacity
                    onPress={increment}
                    disabled={atMax}
                    style={[
                        styles.chevronButton,
                        { backgroundColor: t.paleLavender },
                        atMax && styles.chevronDisabled,
                    ]}
                    hitSlop={layout.hitSlop}
                    accessibilityLabel={`Increase ${label}`}
                    accessibilityRole="button"
                >
                    <Text style={[styles.chevron, { color: atMax ? t.fog : t.ink }]}>▲</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.range, { color: t.fog }]}>
                {min} – {max} {unit}
            </Text>
        </View>
    );
};

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: layout.spacing.l,
    },
    label: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.h2,
        textAlign: 'center',
        marginBottom: layout.spacing.l,
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.spacing.xl,
    },
    dimmed: {
        opacity: 0.4,
    },
    chevronButton: {
        width: 56,
        height: 56,
        borderRadius: layout.borderRadius.l,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevronDisabled: {
        opacity: 0.3,
    },
    chevron: {
        fontSize: 24,
    },
    valueContainer: {
        alignItems: 'center',
        minWidth: 80,
    },
    value: {
        fontFamily: typography.heading,
        fontSize: 48,
        fontWeight: typography.weights.bold as any,
    },
    unit: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        marginTop: layout.spacing.xs,
    },
    range: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        marginTop: layout.spacing.m,
        opacity: 0.6,
    },
});
