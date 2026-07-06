import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

export interface KdfParams {
    algorithm: 'argon2id';
    memory: number;      // KiB
    passes: number;      // time cost (iterations)
    parallelism: number;
    tagLength: number;   // derived key length in bytes
}

/**
 * OWASP-recommended Argon2id baseline for interactive use (memory >= 19 MiB,
 * t = 2, p = 1). These are recorded in the backup envelope so a future restore
 * reproduces the derivation even if the defaults later change (forward-safe).
 */
export const DEFAULT_KDF_PARAMS: KdfParams = {
    algorithm: 'argon2id',
    memory: 19456, // 19 MiB
    passes: 2,
    parallelism: 1,
    tagLength: 32,
};

const SALT_LENGTH = 16;
const qc: any = QuickCrypto;

// Bounds for kdf.params read back from a backup file. A restore reads these
// straight from untrusted JSON (a corrupted or malicious .locket file); without
// a ceiling, an absurd `memory` value can hang/OOM the device mid-restore, and
// without a floor, a tampered file could silently ask for a weaker derivation
// than this app ever produces. Ceiling is generous (4x default) to stay
// forward-compatible with future cost increases.
const MIN_MEMORY = DEFAULT_KDF_PARAMS.memory;
const MAX_MEMORY = DEFAULT_KDF_PARAMS.memory * 4;
const MIN_PASSES = DEFAULT_KDF_PARAMS.passes;
const MAX_PARALLELISM = 4;
const REQUIRED_TAG_LENGTH = DEFAULT_KDF_PARAMS.tagLength;

/** Fresh random salt (hex). One per backup export; stored in the envelope. */
export function generateSalt(): string {
    return Buffer.from(qc.randomBytes(SALT_LENGTH)).toString('hex');
}

/**
 * Derive a key (hex, `params.tagLength` bytes) from a password + salt using
 * Argon2id. Argon2id is provided natively by react-native-quick-crypto (1.0.13,
 * vendored OpenSSL 3.6) on both iOS and Android — no extra dependency.
 *
 * NOTE: Argon2id output correctness is verified by a device/[->E2E] known-answer
 * test; it cannot run under node vitest (no native binding). The unit test here
 * covers the wrapper: param passing, hex encoding, and unsupported-algo guard.
 */
export function deriveKeyFromPassword(
    password: string,
    saltHex: string,
    params: KdfParams = DEFAULT_KDF_PARAMS,
): string {
    if (params.algorithm !== 'argon2id') {
        throw new Error(`Unsupported KDF algorithm: ${params.algorithm}`);
    }
    if (
        params.memory < MIN_MEMORY || params.memory > MAX_MEMORY ||
        params.passes < MIN_PASSES ||
        params.parallelism < 1 || params.parallelism > MAX_PARALLELISM ||
        params.tagLength !== REQUIRED_TAG_LENGTH
    ) {
        throw new Error('Backup file has invalid or corrupted KDF parameters.');
    }
    const derived = qc.argon2Sync('argon2id', {
        message: Buffer.from(password, 'utf8'),
        nonce: Buffer.from(saltHex, 'hex'),
        parallelism: params.parallelism,
        tagLength: params.tagLength,
        memory: params.memory,
        passes: params.passes,
    });
    return Buffer.from(derived).toString('hex');
}
