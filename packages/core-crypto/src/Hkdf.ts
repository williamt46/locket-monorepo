import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

const qc: any = QuickCrypto;

/**
 * Derive a 32-byte, context-separated sub-key (hex) from the master key using
 * HKDF-SHA256. Deterministic per (masterKey, context): the same context always
 * yields the same sub-key, so data wrapped under it stays readable. Distinct
 * contexts yield independent keys, so one leaked sub-key does not expose others.
 *
 * Provided natively by react-native-quick-crypto (hkdfSync) — no extra dependency.
 */
export function deriveSubKey(masterKeyHex: string, context: string): string {
    const ikm = Buffer.from(masterKeyHex, 'hex');
    const salt = Buffer.alloc(0);
    const info = Buffer.from(context, 'utf8');
    const derived = qc.hkdfSync('sha256', ikm, salt, info, 32);
    return Buffer.from(derived).toString('hex');
}
