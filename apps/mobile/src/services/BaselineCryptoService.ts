import { LocketCryptoService, deriveSubKey } from '@locket/core-crypto';
import type { EncryptedPackage } from '@locket/core-crypto';
import { canonicalStringify } from '@locket/shared';
import { BaselineCycleData, normalizeBaseline } from '../models/BaselineCycleData';

// HKDF context that separates the baseline sub-key from every other key derived
// from the master key. Baked into the envelope so a future context change stays
// backward-readable.
const BASELINE_CONTEXT = 'baseline-cycle-v1';

const gcm = new LocketCryptoService();

/** At-rest envelope for baseline cycle data (written to locket_baseline_v2). */
export interface BaselineEnvelope {
    v: 1;
    kdfContext: string;
    ct: EncryptedPackage; // AES-256-GCM of canonicalStringify(baseline) under the HKDF sub-key
}

/** Wrap baseline data under HKDF(masterKey, 'baseline-cycle-v1') + AES-256-GCM. */
export function wrapBaseline(masterKeyHex: string, data: BaselineCycleData): BaselineEnvelope {
    const subKey = deriveSubKey(masterKeyHex, BASELINE_CONTEXT);
    return {
        v: 1,
        kdfContext: BASELINE_CONTEXT,
        ct: gcm.encryptString(canonicalStringify(data), subKey),
    };
}

/** Unwrap a baseline envelope. Throws (GCM auth) on tamper or a wrong master key. */
export function unwrapBaseline(masterKeyHex: string, env: BaselineEnvelope): BaselineCycleData {
    const subKey = deriveSubKey(masterKeyHex, env.kdfContext || BASELINE_CONTEXT);
    // Read-side default for the additive `estimatedFields` (T7/§4): pre-T7
    // payloads lack the key, so normalize to `[]` on the way out.
    return normalizeBaseline(
        JSON.parse(gcm.decryptString(env.ct, subKey)) as BaselineCycleData,
    );
}
