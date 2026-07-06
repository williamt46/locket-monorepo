import QuickCrypto from 'react-native-quick-crypto';

/**
 * Short, non-invertible witness of a master key for QA logs: the first 8 hex
 * chars of SHA-256(keyHex). Enough to see "the key changed / matches" across
 * backup → reset → restore in the console; useless for recovering the 256-bit
 * key (one-way hash, 32 bits displayed). Never log raw key material.
 */
export function keyFingerprint(keyHex: string | null | undefined): string {
    if (!keyHex) return '(none)';
    const h = QuickCrypto.createHash('sha256');
    h.update(keyHex);
    return h.digest('hex').toString().slice(0, 8);
}
