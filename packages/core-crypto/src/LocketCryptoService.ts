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

    async encryptData(data: any, keyHex: string): Promise<EncryptedPackage> {
        return new Promise((resolve, reject) => {
            try {
                // 1. Canonical Serialization (Solving the Hashing Bug)
                const dataStr = canonicalStringify(data);

                const key = Buffer.from(keyHex, 'hex');
                const iv = this.qc.randomBytes(IV_LENGTH);

                const cipher = this.qc.createCipheriv(ALGORITHM, key, iv);
                let encrypted = cipher.update(dataStr, 'utf8', 'hex');
                encrypted += cipher.final('hex');
                const authTag = cipher.getAuthTag().toString('hex');

                resolve({
                    iv: iv.toString('hex'),
                    encryptedData: encrypted,
                    authTag: authTag
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async decryptData(encryptedPackage: EncryptedPackage, keyHex: string): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                const key = Buffer.from(keyHex, 'hex');
                const iv = Buffer.from(encryptedPackage.iv, 'hex');
                const authTag = Buffer.from(encryptedPackage.authTag, 'hex');

                const decipher = this.qc.createDecipheriv(ALGORITHM, key, iv);
                decipher.setAuthTag(authTag);

                let decrypted = decipher.update(encryptedPackage.encryptedData, 'hex', 'utf8');
                decrypted += decipher.final('utf8');

                try {
                    resolve(JSON.parse(decrypted));
                } catch {
                    resolve(decrypted);
                }
            } catch (e) {
                reject(e);
            }
        });
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
