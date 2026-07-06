import * as SecureStore from 'expo-secure-store';

/**
 * User preference: require Face ID / Touch ID to unlock.
 *
 * Default ON — an unlock gate is the expected posture for a health-data app.
 * When OFF (or when the device has no enrolled biometric), the lock screen is
 * tap-to-unlock; the data at rest stays AES-GCM-encrypted regardless.
 */

const BIOMETRIC_ENABLED_KEY = 'locket_biometric_enabled';

export const getBiometricEnabled = async (): Promise<boolean> => {
    try {
        const v = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        // Unset → default ON.
        return v === null ? true : v === 'true';
    } catch {
        return true;
    }
};

export const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
};
