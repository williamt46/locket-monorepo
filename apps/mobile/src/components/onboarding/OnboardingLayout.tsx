import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';
import {
    createDefaultBaselineCycleData,
    clampValue,
    PERIOD_MIN,
    PERIOD_MAX,
    CYCLE_MIN,
    CYCLE_MAX,
    PERIOD_DEFAULT,
    CYCLE_DEFAULT,
    type BaselineCycleData,
    type EstimatedField,
} from '../../models/BaselineCycleData';
import { StepWelcome } from './StepWelcome';
import { StepLastPeriod } from './StepLastPeriod';
import { StepNumberPicker } from './StepNumberPicker';

// ── Props ───────────────────────────────────────────────────────────

interface OnboardingLayoutProps {
    /** Called when the user completes the wizard ("Seal Ledger"). */
    onComplete: (config: BaselineCycleData) => void;
}

// ── Step count ──────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

// Which estimated field each input step governs (step 0 = Welcome, no field).
const STEP_FIELD: Record<number, EstimatedField | undefined> = {
    1: 'lastPeriodDate',
    2: 'periodLength',
    3: 'cycleLength',
};

// ── Pure helpers ────────────────────────────────────────────────────

/** Add a field to the estimated set (idempotent). */
function markEstimated(fields: EstimatedField[] | undefined, field: EstimatedField): EstimatedField[] {
    const arr = fields ?? [];
    return arr.includes(field) ? arr : [...arr, field];
}

/** Remove a field from the estimated set — the user supplied a real value. */
function clearEstimated(fields: EstimatedField[] | undefined, field: EstimatedField): EstimatedField[] {
    return (fields ?? []).filter((f) => f !== field);
}

// ── Component ───────────────────────────────────────────────────────

/**
 * OnboardingLayout — 4-step wizard for establishing the user's ledger.
 *
 * Step 0: Welcome (no input)
 * Step 1: Last period date        — "I'm not sure" → date unknown, no seeding
 * Step 2: Period length (1–20)    — "I'm not sure" → 5 days (clinical median)
 * Step 3: Cycle length (10–100)   — "I'm not sure" → 28 days (clinical median)
 *
 * Each input step carries a tertiary "I'm not sure" text button (T7/§4). Choosing
 * it flags the field in `estimatedFields`, dims the picker, and shows a caption.
 * Predictions treat any estimated baseline as a "learning" state downstream.
 */
export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
    onComplete,
}) => {
    const { t } = useTheme();
    const [step, setStep] = useState(0);
    const [config, setConfig] = useState<BaselineCycleData>(createDefaultBaselineCycleData);

    // ── Step navigation ───────────────────────────────────────────────
    const goBack = useCallback(() => {
        setStep((s) => Math.max(0, s - 1));
    }, []);

    const goNext = useCallback(() => {
        setStep((s) => (s < TOTAL_STEPS - 1 ? s + 1 : s));
    }, []);

    const handleSeal = useCallback(() => {
        onComplete(config);
    }, [config, onComplete]);

    // ── Config updaters (manual entry clears the "estimated" flag) ─────
    const setLastPeriodDate = useCallback((date: string) => {
        setConfig((c) => ({
            ...c,
            lastPeriodDate: date,
            estimatedFields: clearEstimated(c.estimatedFields, 'lastPeriodDate'),
        }));
    }, []);

    const setPeriodLength = useCallback((v: number) => {
        const clamped = clampValue(v, PERIOD_MIN, PERIOD_MAX);
        setConfig((c) => ({
            ...c,
            periodLength: clamped,
            estimatedFields: clearEstimated(c.estimatedFields, 'periodLength'),
        }));
    }, []);

    const setCycleLength = useCallback((v: number) => {
        const clamped = clampValue(v, CYCLE_MIN, CYCLE_MAX);
        setConfig((c) => ({
            ...c,
            cycleLength: clamped,
            estimatedFields: clearEstimated(c.estimatedFields, 'cycleLength'),
        }));
    }, []);

    // ── "I'm not sure" — apply the clinical default & flag as estimated ──
    const handleUnsure = useCallback(() => {
        const field = STEP_FIELD[step];
        if (!field) return;
        setConfig((c) => {
            const next = { ...c, estimatedFields: markEstimated(c.estimatedFields, field) };
            if (field === 'lastPeriodDate') {
                // No real anchor — leave the date undefined. No ledger seeding;
                // predictions stay dormant until a Period Start is logged.
                delete next.lastPeriodDate;
            } else if (field === 'periodLength') {
                next.periodLength = PERIOD_DEFAULT;
            } else if (field === 'cycleLength') {
                next.cycleLength = CYCLE_DEFAULT;
            }
            return next;
        });
        goNext();
    }, [step, goNext]);

    // ── Derived per-step state ────────────────────────────────────────
    const currentField = STEP_FIELD[step];
    const isEstimated = currentField ? (config.estimatedFields ?? []).includes(currentField) : false;

    // ── Step rendering ────────────────────────────────────────────────
    const renderStep = () => {
        switch (step) {
            case 0:
                return <StepWelcome />;
            case 1:
                return (
                    <StepLastPeriod
                        value={config.lastPeriodDate ?? ''}
                        onChange={setLastPeriodDate}
                        dimmed={isEstimated}
                    />
                );
            case 2:
                return (
                    <StepNumberPicker
                        value={config.periodLength}
                        onChange={setPeriodLength}
                        min={PERIOD_MIN}
                        max={PERIOD_MAX}
                        label="Period Length"
                        unit="days"
                        dimmed={isEstimated}
                    />
                );
            case 3:
                return (
                    <StepNumberPicker
                        value={config.cycleLength}
                        onChange={setCycleLength}
                        min={CYCLE_MIN}
                        max={CYCLE_MAX}
                        label="Cycle Length"
                        unit="days"
                        dimmed={isEstimated}
                    />
                );
            default:
                return null;
        }
    };

    // ── Step indicator dots ───────────────────────────────────────────
    const renderDots = () => (
        <View style={styles.dotsRow}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <View
                    key={i}
                    style={[
                        styles.dot,
                        { backgroundColor: t.paleLavender },
                        i === step && [styles.dotActive, { backgroundColor: t.locketBlue }],
                    ]}
                />
            ))}
        </View>
    );

    // ── Render ────────────────────────────────────────────────────────
    const isFirstStep = step === 0;
    const isLastStep = step === TOTAL_STEPS - 1;
    const isInputStep = !!currentField;

    return (
        <View style={[styles.root, { backgroundColor: t.paper }]}>
            {/* Header with step dots */}
            <View style={styles.header}>{renderDots()}</View>

            {/* Step content */}
            <View style={styles.content}>
                {renderStep()}

                {/* Estimate caption when the current field is a typical value */}
                {isInputStep && isEstimated && (
                    <Text style={[styles.estimateCaption, { color: t.fog }]}>
                        Using a typical value — you can change this in Settings
                    </Text>
                )}

                {/* Tertiary "I'm not sure" — only on input steps, only when not already estimated */}
                {isInputStep && !isEstimated && (
                    <TouchableOpacity
                        onPress={handleUnsure}
                        style={styles.unsureButton}
                        hitSlop={layout.hitSlop}
                        accessibilityRole="button"
                        accessibilityLabel="I'm not sure — use a typical value"
                    >
                        <Text style={[styles.unsureText, { color: t.fog }]}>I'm not sure</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Seal sub-caption to reduce first-run anxiety */}
            {isLastStep && (
                <Text style={[styles.sealCaption, { color: t.fog }]}>
                    Estimates are fine — Locket learns as you log
                </Text>
            )}

            {/* Bottom navigation bar */}
            <View style={styles.navBar}>
                {!isFirstStep ? (
                    <TouchableOpacity
                        onPress={goBack}
                        style={styles.navButton}
                        hitSlop={layout.hitSlop}
                        accessibilityLabel="Go back"
                        accessibilityRole="button"
                    >
                        <Text style={[styles.navButtonText, { color: t.fog }]}>Back</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.navButton} />
                )}

                {isLastStep ? (
                    <TouchableOpacity
                        onPress={handleSeal}
                        style={[styles.navButton, styles.ctaButton, { backgroundColor: t.gold }]}
                        hitSlop={layout.hitSlop}
                        accessibilityLabel="Seal your ledger"
                        accessibilityRole="button"
                    >
                        <Text style={[styles.ctaText, { color: t.ink }]}>Seal Ledger</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={goNext}
                        style={[styles.navButton, styles.ctaButton, { backgroundColor: t.locketBlue }]}
                        hitSlop={layout.hitSlop}
                        accessibilityLabel="Next step"
                        accessibilityRole="button"
                    >
                        <Text style={[styles.ctaText, styles.ctaTextLight]}>Next</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: layout.spacing.m,
        alignItems: 'center',
    },
    dotsRow: {
        flexDirection: 'row',
        gap: layout.spacing.s,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotActive: {
        width: 24,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    estimateCaption: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        textAlign: 'center',
        marginTop: layout.spacing.m,
        paddingHorizontal: layout.spacing.l,
    },
    unsureButton: {
        minHeight: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: layout.spacing.m,
        alignSelf: 'center',
        paddingHorizontal: layout.spacing.l,
    },
    unsureText: {
        fontFamily: typography.body,
        fontSize: 16,
        textDecorationLine: 'underline',
    },
    sealCaption: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        textAlign: 'center',
        marginBottom: layout.spacing.s,
        paddingHorizontal: layout.spacing.l,
    },
    navBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: layout.spacing.l,
        paddingBottom: 40,
        paddingTop: layout.spacing.m,
    },
    navButton: {
        minWidth: 100,
        minHeight: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: layout.borderRadius.m,
    },
    navButtonText: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
    },
    ctaButton: {
        paddingHorizontal: layout.spacing.l,
    },
    ctaText: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.body,
        fontWeight: typography.weights.bold as any,
    },
    ctaTextLight: {
        color: '#FFFFFF',
    },
});
