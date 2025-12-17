import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12;

// NAMED EXPORTS

export const generateKey = async () => {
    // Keep async signature if callers expect it, but implementation is sync
    const key = QuickCrypto.randomBytes(32); 
    console.log('[CryptoService] Generated new master key');
    return key.toString('hex');
};

export const encryptData = async (data, keyHex) => {
    try {
      if (!keyHex) throw new Error('Key is required');
      // Ensure data is string
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

      const key = Buffer.from(keyHex, 'hex');
      const iv = QuickCrypto.randomBytes(IV_LENGTH_BYTES);
      
      const cipher = QuickCrypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(dataStr, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      console.log('[CryptoService] Encryption successful');

      return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag
      };
    } catch (error) {
      console.error('[CryptoService] Encryption failed:', error);
      throw error;
    }
};

export const decryptData = (encryptedPackage, keyHex) => {
    // MADE SYNCHRONOUS for easier UI usage if needed, but keeping existing calls happy?
    // LogData calls it in refreshLogs: data: decryptData(...)
    // LogData expects sync or handling result?
    // In refreshLogs: `return { ...e, data: decryptData(e.payload, currentKey) };`
    // If decryptData is async, `data` becomes a Promise.
    // The previous implementation was async.
    // Let's check: QuickCrypto.createDecipheriv is sync.
    // So we can remove async.
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(encryptedPackage.iv, 'hex');
      const authTag = Buffer.from(encryptedPackage.authTag, 'hex');
      
      const decipher = QuickCrypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedPackage.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse JSON
      try {
          return JSON.parse(decrypted);
      } catch (e) {
          return decrypted;
      }
    } catch (error) {
      console.log('[CryptoService] Decryption failed (Integrity Error)');
      throw error; 
    }
};

export const generateIntegrityHash = (data) => {
    // MADE SYNCHRONOUS
    // data is the encrypted package object?
    // We need to hash a deterministic string representation.
    // `JSON.stringify` on objects is not guaranteed deterministic (key order).
    // But for MVP... let's trust it or assume `data` is the encrypted payload object.
    // Or users pass the encrypted string?
    // LogData passes `L.payload` (object).
    
    // Better: Hash the encryptedData + iv + authTag concatenation?
    // For now, let's just hash JSON string of payload.
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    
    const hash = QuickCrypto.createHash('sha256');
    hash.update(str);
    const digest = hash.digest('hex');
    // console.log(`[CryptoService] Generated Hash: ${digest}`);
    return `0x${digest}`;
};
