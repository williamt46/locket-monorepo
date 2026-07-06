import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('react-native-quick-crypto', () => ({
    default: {
        createHash: (a: string) => crypto.createHash(a),
    },
}));

import { keyFingerprint } from '../../src/utils/keyFingerprint';

describe('keyFingerprint — non-invertible key witness', () => {
    const KEY = crypto.randomBytes(32).toString('hex');

    it('is deterministic and 8 lowercase hex chars', () => {
        const fp = keyFingerprint(KEY);
        expect(fp).toMatch(/^[0-9a-f]{8}$/);
        expect(keyFingerprint(KEY)).toBe(fp);
    });

    it('differs for different keys', () => {
        const other = crypto.randomBytes(32).toString('hex');
        expect(keyFingerprint(other)).not.toBe(keyFingerprint(KEY));
    });

    it('never echoes raw key material', () => {
        // The fp is a hash prefix, not a slice of the key itself.
        expect(KEY.includes(keyFingerprint(KEY))).toBe(false);
    });

    it('handles a missing key without throwing', () => {
        expect(keyFingerprint(null)).toBe('(none)');
        expect(keyFingerprint(undefined)).toBe('(none)');
        expect(keyFingerprint('')).toBe('(none)');
    });
});
