import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the native module. Argon2id correctness is a device/[->E2E] known-answer
// check; here we verify the wrapper passes the right params and encodes hex.
const argon2Sync = vi.fn();
const randomBytes = vi.fn();
vi.mock('react-native-quick-crypto', () => ({
    default: {
        argon2Sync: (...a: any[]) => argon2Sync(...a),
        randomBytes: (...a: any[]) => randomBytes(...a),
    },
}));

import { deriveKeyFromPassword, generateSalt, DEFAULT_KDF_PARAMS } from './KeyDerivation.js';
import { Buffer } from '@craftzdog/react-native-buffer';

describe('KeyDerivation (Argon2id wrapper)', () => {
    beforeEach(() => { argon2Sync.mockReset(); randomBytes.mockReset(); });

    it('generateSalt returns 16 random bytes as hex', () => {
        randomBytes.mockReturnValue(Buffer.alloc(16, 7));
        const salt = generateSalt();
        expect(salt).toHaveLength(32); // 16 bytes -> 32 hex chars
        expect(randomBytes).toHaveBeenCalledWith(16);
    });

    it('derives via argon2id with the right params and returns hex', () => {
        argon2Sync.mockReturnValue(Buffer.alloc(32, 0xab));
        const key = deriveKeyFromPassword('hunter2hunter2', '00ff'.repeat(8), DEFAULT_KDF_PARAMS);
        expect(key).toBe('ab'.repeat(32));
        expect(argon2Sync).toHaveBeenCalledTimes(1);
        const [algo, params] = argon2Sync.mock.calls[0];
        expect(algo).toBe('argon2id');
        expect(params.parallelism).toBe(DEFAULT_KDF_PARAMS.parallelism);
        expect(params.memory).toBe(DEFAULT_KDF_PARAMS.memory);
        expect(params.passes).toBe(DEFAULT_KDF_PARAMS.passes);
        expect(params.tagLength).toBe(32);
        expect(Buffer.from(params.message).toString('utf8')).toBe('hunter2hunter2');
        expect(Buffer.from(params.nonce).toString('hex')).toBe('00ff'.repeat(8));
    });

    it('rejects an unsupported KDF algorithm', () => {
        expect(() => deriveKeyFromPassword('xxxxxxxxxxxx', '00', { ...DEFAULT_KDF_PARAMS, algorithm: 'scrypt' as any }))
            .toThrow(/Unsupported KDF algorithm/);
        expect(argon2Sync).not.toHaveBeenCalled();
    });
});
