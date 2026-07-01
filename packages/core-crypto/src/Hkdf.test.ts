import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native-quick-crypto', () => {
    const nodeCrypto = require('crypto');
    return {
        default: {
            hkdfSync: (d: string, k: any, s: any, i: any, l: number) => nodeCrypto.hkdfSync(d, k, s, i, l),
        },
    };
});

import { deriveSubKey } from './Hkdf.js';

const MASTER = 'ab'.repeat(32); // 32-byte master key, hex

describe('deriveSubKey (HKDF-SHA256 sub-keys)', () => {
    it('returns a 32-byte key as hex', () => {
        const k = deriveSubKey(MASTER, 'baseline-cycle-v1');
        expect(k).toHaveLength(64);
    });

    it('is deterministic per (masterKey, context)', () => {
        expect(deriveSubKey(MASTER, 'baseline-cycle-v1')).toBe(deriveSubKey(MASTER, 'baseline-cycle-v1'));
    });

    it('separates keys by context', () => {
        expect(deriveSubKey(MASTER, 'baseline-cycle-v1')).not.toBe(deriveSubKey(MASTER, 'pre-keypair-v1'));
    });

    it('separates keys by master key', () => {
        expect(deriveSubKey(MASTER, 'baseline-cycle-v1')).not.toBe(deriveSubKey('cd'.repeat(32), 'baseline-cycle-v1'));
    });
});
