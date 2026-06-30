import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { canonicalStringify } from '@locket/shared';
import { CryptoService, EncryptedPackage } from './types.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export class LocketCryptoService implements CryptoService {
    private qc: any = QuickCrypto;

    async generateKey(): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                const key = this.qc.randomBytes(32);
                resolve(key.toString('hex'));
            } catch (e) {
                reject(e);
            }
        });
    }

    // ── Single AES-256-GCM primitive ────────────────────────────────────────
    // All GCM in the app routes through these two methods (event encryption,
    // backup DEK / data / master-key wrapping) so there is one implementation,
    // one algorithm constant, one IV length. Operates on raw utf8/hex strings.

    encryptString(plaintext: string, keyHex: string): EncryptedPackage {
        const key = Buffer.from(keyHex, 'hex');
        const iv = this.qc.randomBytes(IV_LENGTH);
        const cipher = this.qc.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return {
            iv: iv.toString('hex'),
            encryptedData: encrypted,
            authTag: cipher.getAuthTag().toString('hex'),
        };
    }

    decryptString(pkg: EncryptedPackage, keyHex: string): string {
        const key = Buffer.from(keyHex, 'hex');
        const iv = Buffer.from(pkg.iv, 'hex');
        const decipher = this.qc.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(Buffer.from(pkg.authTag, 'hex'));
        let decrypted = decipher.update(pkg.encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    // JSON-oriented wrappers over the single primitive above. encryptData
    // canonicalizes before encrypting; decryptData JSON-parses, falling back to
    // the raw string for non-JSON payloads (e.g. wrapped key material).
    async encryptData(data: any, keyHex: string): Promise<EncryptedPackage> {
        return this.encryptString(canonicalStringify(data), keyHex);
    }

    async decryptData(encryptedPackage: EncryptedPackage, keyHex: string): Promise<any> {
        const decrypted = this.decryptString(encryptedPackage, keyHex);
        try {
            return JSON.parse(decrypted);
        } catch (pe) {
            console.log('[LocketCryptoService] JSON parse failed during decryption. Result was not an object:', decrypted.substring(0, 50) + '...');
            return decrypted;
        }
    }

    /**
     * Solving the "Potemkin" Ledger integrity issues.
     * Generates a deterministic hash of the encrypted package.
     */
    async generateIntegrityHash(pkg: EncryptedPackage): Promise<string> {
        return new Promise((resolve) => {
            // Hash the canonical representation of the encrypted package
            const str = canonicalStringify(pkg);
            const hash = this.qc.createHash('sha256');
            hash.update(str);
            resolve(`0x${hash.digest('hex')}`);
        });
    }
}
