import React, { useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';
import { clampValue } from '../../models/UserConfig';

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
}) => {
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
            <Text style={styles.label}>{label}</Text>

            <View style={styles.pickerRow}>
                <TouchableOpacity
                    onPress={decrement}
                    disabled={atMin}
                    style={[styles.chevronButton, atMin && styles.chevronDisabled]}
                    hitSlop={layout.hitSlop}
                    accessibilityLabel={`Decrease ${label}`}
                    accessibilityRole="button"
                >
                    <Text style={[styles.chevron, atMin && styles.chevronTextDisabled]}>
                        ▼
                    </Text>
                </TouchableOpacity>

                <View style={styles.valueContainer}>
                    <Text style={styles.value}>{value}</Text>
                    <Text style={styles.unit}>{unit}</Text>
                </View>

                <TouchableOpacity
                    onPress={increment}
                    disabled={atMax}
                    style={[styles.chevronButton, atMax && styles.chevronDisabled]}
                    hitSlop={layout.hitSlop}
                    accessibilityLabel={`Increase ${label}`}
                    accessibilityRole="button"
                >
                    <Text style={[styles.chevron, atMax && styles.chevronTextDisabled]}>
                        ▲
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.range}>
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
        color: colors.charcoal,
        textAlign: 'center',
        marginBottom: layout.spacing.l,
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.spacing.xl,
    },
    chevronButton: {
        width: 56,
        height: 56,
        borderRadius: layout.borderRadius.l,
        backgroundColor: colors.watermark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevronDisabled: {
        opacity: 0.3,
    },
    chevron: {
        fontSize: 24,
        color: colors.charcoal,
    },
    chevronTextDisabled: {
        color: colors.graphite,
    },
    valueContainer: {
        alignItems: 'center',
        minWidth: 80,
    },
    value: {
        fontFamily: typography.heading,
        fontSize: 48,
        color: colors.inkBlue,
        fontWeight: typography.weights.bold as any,
    },
    unit: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        color: colors.graphite,
        marginTop: layout.spacing.xs,
    },
    range: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        color: colors.graphite,
        marginTop: layout.spacing.m,
        opacity: 0.6,
    },
});
