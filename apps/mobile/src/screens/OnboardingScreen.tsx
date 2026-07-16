import React, { useCallback } from 'react';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { OnboardingLayout } from '../components/onboarding/OnboardingLayout';
import { saveUserConfig } from '../services/StorageService';
import type { BaselineCycleData } from '../models/BaselineCycleData';

/**
 * OnboardingScreen — Thin wrapper that composes OnboardingLayout
 * and handles the "Seal Ledger" action (persist config + navigate away).
 */
export const OnboardingScreen = ({ navigation }: any) => {
    const handleComplete = useCallback(
        async (config: BaselineCycleData) => {
            // Privacy: baseline is GDPR Art. 9 health data — log presence/shape, never
            // the raw lastPeriodDate or cycle numbers. saveUserConfig emits the
            // post-write confirmation with the same value-free shape.
            console.log(
                `[Onboarding] Sealing ledger — ` +
                `hasAnchorDate=${config.lastPeriodDate != null}, ` +
                `estimatedFields=[${(config.estimatedFields ?? []).join(',')}]`,
            );
            await saveUserConfig(config);
            console.log(`[Onboarding] Config saved to SecureStore.`);
            navigation.replace('Auth');
        },
        [navigation],
    );

    return (
        <ScreenWrapper>
            <OnboardingLayout onComplete={handleComplete} />
        </ScreenWrapper>
    );
};
