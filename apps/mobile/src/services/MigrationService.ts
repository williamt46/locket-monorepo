import * as SecureStore from 'expo-secure-store';
import { SecureKeyService } from './SecureKeyService';
import { wrapBaseline, unwrapBaseline } from './BaselineCryptoService';
import { BaselineCycleData } from '../models/BaselineCycleData';

const USER_CONFIG_KEY = 'locket_user_config'; // legacy plaintext baseline
const BASELINE_KEY = 'locket_baseline_v2';     // AES-GCM-wrapped baseline

// Session short-circuit so the boot path runs migrations at most once. Resets
// each app launch (module reload), so a failed migration is retried next launch.
let migrated = false;

/**
 * Single owner of one-shot, idempotent, crash-safe launch migrations. Runs after
 * the master key is available. Currently: legacy plaintext baseline → wrapped
 * locket_baseline_v2. Never throws to the caller — a failure leaves the legacy
 * entry intact (getUserConfig still reads it) and is retried next launch.
 */
export async function runMigrations(): Promise<void> {
    if (migrated) return;
    try {
        await migrateBaselineToV2();
    } catch (e) {
        console.error('[Migration] baseline migration failed; legacy entry preserved', e);
    }
    migrated = true;
}

async function migrateBaselineToV2(): Promise<void> {
    const wrapped = await SecureStore.getItemAsync(BASELINE_KEY);
    const legacy = await SecureStore.getItemAsync(USER_CONFIG_KEY);

    // Already migrated (or a restore wrote v2 directly). If a stale plaintext
    // lingers — e.g. a crash last time between the verify and the delete — remove
    // it now so nothing plaintext is left behind. Idempotent.
    if (wrapped) {
        if (legacy) await SecureStore.deleteItemAsync(USER_CONFIG_KEY);
        return;
    }

    // Fresh install (or already fully migrated): nothing to do.
    if (!legacy) return;

    let config: BaselineCycleData;
    try {
        config = JSON.parse(legacy) as BaselineCycleData;
    } catch {
        // Unparseable legacy entry — do not destroy it blindly.
        console.error('[Migration] legacy baseline unparseable; skipping');
        return;
    }

    const masterKeyHex = await SecureKeyService.getOrGenerateKey();

    // Write new → verify read-back → delete old. Order is crash-safe: a crash
    // before the delete just leaves both, and the next run cleans up the legacy.
    await SecureStore.setItemAsync(BASELINE_KEY, JSON.stringify(wrapBaseline(masterKeyHex, config)));

    const verify = await SecureStore.getItemAsync(BASELINE_KEY);
    if (!verify) throw new Error('verify read failed after write');
    const roundTrip = unwrapBaseline(masterKeyHex, JSON.parse(verify));
    if (
        roundTrip.lastPeriodDate !== config.lastPeriodDate ||
        roundTrip.cycleLength !== config.cycleLength ||
        roundTrip.periodLength !== config.periodLength
    ) {
        throw new Error('verify mismatch; keeping legacy plaintext');
    }

    await SecureStore.deleteItemAsync(USER_CONFIG_KEY);
    console.log('[Migration] baseline migrated to locket_baseline_v2');
}

/** Test hook: clear the session short-circuit. */
export function resetMigrationFlag(): void {
    migrated = false;
}
