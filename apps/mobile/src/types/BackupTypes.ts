import type { EncryptedPackage, KdfParams } from '@locket/core-crypto';

/**
 * v1 (legacy) backup envelope. Same-device only: the DEK is wrapped under the
 * device master key, which is NOT in the file, so it cannot be restored on a
 * device that doesn't already hold that master key.
 */
export interface LocketBackupFileV1 {
    version: 1;
    createdAt: number;
    integrityHash: string;
    envelope: {
        wrappedDEK: string;
        dekIV: string;
        dekAuthTag: string;
        dataIV: string;
        dataAuthTag: string;
        encryptedData: string;
    };
}

/**
 * v2 backup envelope. Restorable on a new device: a copy of the master key is
 * wrapped under a password-derived KEK (Argon2id) and embedded in the file. The
 * chain is password -> KEK -> masterKey -> DEK -> data.
 */
export interface LocketBackupFileV2 {
    version: 2;
    createdAt: number;
    integrityHash: string;
    kdf: { salt: string; params: KdfParams };
    masterKey: EncryptedPackage; // master key (hex) wrapped under the password-derived KEK
    dek: EncryptedPackage;       // DEK (hex) wrapped under the master key
    data: EncryptedPackage;      // payload encrypted under the DEK
}

