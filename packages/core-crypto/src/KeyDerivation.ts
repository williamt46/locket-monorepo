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
