import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('react-native-quick-crypto', () => ({
    default: {
        randomBytes: (n: number) => crypto.randomBytes(n),
        createHash: (a: string) => crypto.createHash(a),
        createCipheriv: (a: string, k: Buffer, iv: Buffer) => crypto.createCipheriv(a, k, iv),
        createDecipheriv: (a: string, k: Buffer, iv: Buffer) => crypto.createDecipheriv(a, k, iv),
        hkdfSync: (d: string, k: any, s: any, i: any, l: number) => crypto.hkdfSync(d, k, s, i, l),
    },
}));

import { wrapBaseline, unwrapBaseline } from '../../src/services/BaselineCryptoService';

const MK = crypto.randomBytes(32).toString('hex');
// Pre-T7 shape: no `estimatedFields` key (simulates an old encrypted payload).
const BASELINE = { lastPeriodDate: '2026-02-12', periodLength: 5, cycleLength: 28, hasSeededInitialData: true };

describe('BaselineCryptoService — HKDF wrap/unwrap', () => {
    it('round-trips baseline data, defaulting estimatedFields for pre-T7 payloads', () => {
        const env = wrapBaseline(MK, BASELINE);
        expect(env.v).toBe(1);
        expect(env.kdfContext).toBe('baseline-cycle-v1');
        expect(env.ct.encryptedData).toBeDefined();
        // T7/§4: unwrap applies the read-side default, so an old payload decodes
        // with estimatedFields: [] added, all other fields intact.
        expect(unwrapBaseline(MK, env)).toEqual({ ...BASELINE, estimatedFields: [] });
    });

    it('round-trips a T7 payload with estimatedFields intact', () => {
        const withEstimates = { periodLength: 5, cycleLength: 28, estimatedFields: ['lastPeriodDate', 'cycleLength'] as const };
        const env = wrapBaseline(MK, withEstimates as any);
        expect(unwrapBaseline(MK, env)).toEqual(withEstimates);
    });

    it('rejects a wrong master key (GCM auth)', () => {
        const env = wrapBaseline(MK, BASELINE);
        expect(() => unwrapBaseline(crypto.randomBytes(32).toString('hex'), env)).toThrow();
    });

    it('rejects a single-byte tamper of the ciphertext', () => {
        const env = wrapBaseline(MK, BASELINE);
        const tampered = { ...env, ct: { ...env.ct, authTag: 'ff'.repeat(16) } };
        expect(() => unwrapBaseline(MK, tampered)).toThrow();
    });

    it('does not store plaintext in the envelope', () => {
        const env = wrapBaseline(MK, BASELINE);
        expect(JSON.stringify(env)).not.toContain('2026-02-12');
    });
});
