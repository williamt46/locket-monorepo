import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';
import {
    createDefaultUserConfig,
    clampValue,
    PERIOD_MIN,
    PERIOD_MAX,
    CYCLE_MIN,
    CYCLE_MAX,
    type UserConfig,
} from '../../models/UserConfig';
import { StepWelcome } from './StepWelcome';
import { StepLastPeriod } from './StepLastPeriod';
import { StepNumberPicker } from './StepNumberPicker';

// ── Props ───────────────────────────────────────────────────────────

interface OnboardingLayoutProps {
    /** Called when the user completes the wizard ("Seal Ledger"). */
    onComplete: (config: UserConfig) => void;
}

// ── Step count ──────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

// ── Component ───────────────────────────────────────────────────────

/**
 * OnboardingLayout — 4-step wizard for establishing the user's ledger.
 *
 * Step 0: Welcome (no input)
 * Step 1: Last period date
 * Step 2: Period length (clamped 1–20)
 * Step 3: Cycle length (clamped 10–100)
 */
export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
    onComplete,
}) => {
    const [step, setStep] = useState(0);
    const [config, setConfig] = useState<UserConfig>(createDefaultUserConfig);

    // ── Step navigation ───────────────────────────────────────────────
    const goBack = useCallback(() => {
        setStep((s) => {
            const prev = Math.max(0, s - 1);
            console.log(`[Onboarding] User tapped Back. Step ${s} -> ${prev}. Current Config:`, JSON.stringify(config));
            return prev;
        });
    }, [config]);

    const goNext = useCallback(() => {
        setStep((s) => {
            if (s < TOTAL_STEPS - 1) {
                console.log(`[Onboarding] User tapped Next. Step ${s} -> ${s + 1}. Current Config:`, JSON.stringify(config));
                return s + 1;
            }
            return s;
        });
    }, [config]);

    const handleSeal = useCallback(() => {
        onComplete(config);
    }, [config, onComplete]);

    // ── Config updaters ───────────────────────────────────────────────
    const setLastPeriodDate = useCallback(
        (date: string) => {
            console.log(`[Onboarding] Date selected: ${date}`);
            setConfig((c) => ({ ...c, lastPeriodDate: date }));
        },
        [],
    );

    const setPeriodLength = useCallback(
        (v: number) => {
            const clamped = clampValue(v, PERIOD_MIN, PERIOD_MAX);
            console.log(`[Onboarding] Period length set: ${clamped}`);
            setConfig((c) => ({
                ...c,
                periodLength: clamped,
            }));
        },
        [],
    );

    const setCycleLength = useCallback(
        (v: number) => {
            const clamped = clampValue(v, CYCLE_MIN, CYCLE_MAX);
            console.log(`[Onboarding] Cycle length set: ${clamped}`);
            setConfig((c) => ({
                ...c,
                cycleLength: clamped,
            }));
        },
        [],
    );

    // ── Step rendering ────────────────────────────────────────────────
    const renderStep = () => {
        switch (step) {
            case 0:
                return <StepWelcome />;
            case 1:
                return (
                    <StepLastPeriod
                        value={config.lastPeriodDate}
                        onChange={setLastPeriodDate}
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
                    style={[styles.dot, i === step && styles.dotActive]}
                />
            ))}
        </View>
    );

    // ── Render ────────────────────────────────────────────────────────
    const isFirstStep = step === 0;
    const isLastStep = step === TOTAL_STEPS - 1;

    return (
        <View style={styles.root}>
            {/* Header with step dots */}
            <View style={styles.header}>
                {renderDots()}
            </View>

            {/* Step content */}
            <View style={styles.content}>{renderStep()}</View>

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
                        <Text style={styles.navButtonText}>Back</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.navButton} />
                )}

                {isLastStep ? (
                    <TouchableOpacity
                        onPress={handleSeal}
                        style={[styles.navButton, styles.sealButton]}
                        hitSlop={layout.hitSlop}
                        accessibilityLabel="Seal your ledger"
                        accessibilityRole="button"
                    >
                        <Text style={styles.sealButtonText}>Seal Ledger</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={goNext}
                        style={[styles.navButton, styles.nextButton]}
                        hitSlop={layout.hitSlop}
                        accessibilityLabel="Next step"
                        accessibilityRole="button"
                    >
                        <Text style={styles.nextButtonText}>Next</Text>
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
        backgroundColor: colors.paper,
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
        backgroundColor: colors.watermark,
    },
    dotActive: {
        backgroundColor: colors.inkBlue,
        width: 24,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
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
        color: colors.graphite,
    },
    nextButton: {
        backgroundColor: colors.inkBlue,
        paddingHorizontal: layout.spacing.l,
    },
    nextButtonText: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.body,
        color: colors.paper,
        fontWeight: typography.weights.bold as any,
    },
    sealButton: {
        backgroundColor: colors.gold,
        paddingHorizontal: layout.spacing.l,
    },
    sealButtonText: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.body,
        color: colors.charcoal,
        fontWeight: typography.weights.bold as any,
    },
});
