import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';
import {
    createDefaultBaselineCycleData,
    clampValue,
    toggleEstimatedField,
    PERIOD_MIN,
    PERIOD_MAX,
    CYCLE_MIN,
    CYCLE_MAX,
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

    // Per-step gating (QA item 7a): pickers default to a value, so "answered"
    // is an EXPLICIT interaction — the user either touched the picker/date list
    // or tapped "I'm not sure". Nav stays disabled until then. Keyed by step index.
    const [answeredSteps, setAnsweredSteps] = useState<Record<number, boolean>>({});
    const markAnswered = useCallback((s: number, answered: boolean) => {
        setAnsweredSteps((prev) => ({ ...prev, [s]: answered }));
    }, []);

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

    // ── Config updaters ───────────────────────────────────────────────
    // Manual entry clears the "estimated" flag (mutual exclusivity with "I'm not
    // sure") and marks the step answered (QA item 7a/7b). Each setter belongs to a
    // fixed step, so the step index is a constant here — no stale-closure risk.
    const setLastPeriodDate = useCallback((date: string) => {
        setConfig((c) => ({
            ...c,
            lastPeriodDate: date,
            estimatedFields: clearEstimated(c.estimatedFields, 'lastPeriodDate'),
        }));
        markAnswered(1, true);
    }, [markAnswered]);

    const setPeriodLength = useCallback((v: number) => {
        const clamped = clampValue(v, PERIOD_MIN, PERIOD_MAX);
        setConfig((c) => ({
            ...c,
            periodLength: clamped,
            estimatedFields: clearEstimated(c.estimatedFields, 'periodLength'),
        }));
        markAnswered(2, true);
    }, [markAnswered]);

    const setCycleLength = useCallback((v: number) => {
        const clamped = clampValue(v, CYCLE_MIN, CYCLE_MAX);
        setConfig((c) => ({
            ...c,
            cycleLength: clamped,
            estimatedFields: clearEstimated(c.estimatedFields, 'cycleLength'),
        }));
        markAnswered(3, true);
    }, [markAnswered]);

    // ── "I'm not sure" — toggleable (QA item 7b) ──────────────────────
    // First tap SELECTS: flag estimated, apply the clinical default, step answered.
    // Second tap DESELECTS: un-flag, picker un-dims, step returns to unanswered.
    const handleUnsure = useCallback(() => {
        const field = STEP_FIELD[step];
        if (!field) return;
        const wasEstimated = (config.estimatedFields ?? []).includes(field);
        setConfig((c) => toggleEstimatedField(c, field));
        // Selecting unsure answers the step; deselecting returns it to unanswered.
        markAnswered(step, !wasEstimated);
    }, [step, config.estimatedFields, markAnswered]);

    // ── Derived per-step state ────────────────────────────────────────
    const currentField = STEP_FIELD[step];
    const isEstimated = currentField ? (config.estimatedFields ?? []).includes(currentField) : false;
    // The Welcome step needs no answer; input steps require an explicit interaction.
    const isCurrentAnswered = currentField ? answeredSteps[step] === true : true;

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

                {/* Tertiary "I'm not sure" — toggleable (QA item 7b). Always shown on
                    input steps; a second tap deselects and returns the step to
                    unanswered. Reflects its selected state via accessibilityState. */}
                {isInputStep && (
                    <TouchableOpacity
                        onPress={handleUnsure}
                        style={styles.unsureButton}
                        hitSlop={layout.hitSlop}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isEstimated }}
                        accessibilityLabel={
                            isEstimated
                                ? "I'm not sure — selected, tap to undo"
                                : "I'm not sure — use a typical value"
                        }
                    >
                        <Text
                            style={[
                                styles.unsureText,
                                { color: isEstimated ? t.locketBlue : t.fog },
                            ]}
                        >
                            I'm not sure
                        </Text>
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
                        disabled={!isCurrentAnswered}
                        style={[
                            styles.navButton,
                            styles.ctaButton,
                            { backgroundColor: t.gold },
                            !isCurrentAnswered && styles.ctaDisabled,
                        ]}
                        hitSlop={layout.hitSlop}
                        accessibilityLabel="Seal your ledger"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !isCurrentAnswered }}
                    >
                        <Text style={[styles.ctaText, { color: t.ink }]}>Seal Ledger</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={goNext}
                        disabled={!isCurrentAnswered}
                        style={[
                            styles.navButton,
                            styles.ctaButton,
                            { backgroundColor: t.locketBlue },
                            !isCurrentAnswered && styles.ctaDisabled,
                        ]}
                        hitSlop={layout.hitSlop}
                        accessibilityLabel="Next step"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !isCurrentAnswered }}
                    >
                        <Text style={[styles.ctaText, { color: t.onAccent }]}>Next</Text>
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
    ctaDisabled: {
        opacity: 0.4,
    },
    ctaText: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.body,
        fontWeight: typography.weights.bold as any,
    },
});
