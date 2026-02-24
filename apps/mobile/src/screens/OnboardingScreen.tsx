import React, { useCallback } from 'react';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { OnboardingLayout } from '../components/onboarding/OnboardingLayout';
import { saveUserConfig } from '../services/StorageService';
import type { UserConfig } from '../models/UserConfig';

/**
 * OnboardingScreen — Thin wrapper that composes OnboardingLayout
 * and handles the "Seal Ledger" action (persist config + navigate away).
 */
export const OnboardingScreen = ({ navigation }: any) => {
    const handleComplete = useCallback(
        async (config: UserConfig) => {
            console.log(`[Onboarding] Sealing ledger with final config:`, JSON.stringify(config));
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
