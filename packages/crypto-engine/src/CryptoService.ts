/**
 * @locket/crypto-engine — Umbral Proxy Re-Encryption Service
 *
 * Implements the 6-step PRE workflow:
 * 1. generateUserKeys()         → Owner keypair
 * 2. encryptLocalData()         → Encrypt + hash (capsule, ciphertext, anchorHash)
 * 3. generateConsentKFrag()     → Delegation key fragment for re-encryption
 * 4. proxyReEncrypt()           → Proxy produces cFrag from capsule + kFrag
 * 5. decryptOriginalData()      → Owner self-decrypts
 * 6. decryptAsRecipient()       → Recipient decrypts with cFrags
 */

// Use a Deferred Dynamic Import to avoid static evaluation crashes
import type { SecretKey, PublicKey } from '@nucypher/umbral-pre';
let umbral: typeof import('@nucypher/umbral-pre');

import { canonicalStringify } from '@locket/shared';
import CryptoJS from 'crypto-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserKeyPair {
    /** Base64-encoded secret key (big-endian bytes) */
    secretKeyB64: string;
    /** Base64-encoded compressed public key */
    publicKeyB64: string;
}

export interface EncryptedPayload {
    /** Base64-encoded ciphertext */
    ciphertextB64: string;
    /** Base64-encoded capsule (needed for re-encryption) */
    capsuleB64: string;
    /** SHA-256 anchor hash of the canonical encrypted payload */
    anchorHash: string;
}

export interface ConsentKFrag {
    /** Base64-encoded key fragment for proxy re-encryption */
    kfragB64: string;
    /** Base64-encoded verifying key (owner's signing public key) */
    verifyingKeyB64: string;
}

export interface ReEncryptedCFrag {
    /** Base64-encoded capsule fragment after re-encryption */
    cfragB64: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toB64(arr: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(arr).toString('base64');
    }
    // Browser fallback
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
        binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
}

function fromB64(b64: string): Uint8Array {
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    // Browser fallback
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function sha256Hex(data: string): Promise<string> {
    if (typeof globalThis.crypto?.subtle !== 'undefined') {
        const encoded = new TextEncoder().encode(data);
        const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
        const hashArray = new Uint8Array(hashBuffer);
        return '0x' + Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Universal fallback using crypto-js if native crypto is unavailable
    return '0x' + CryptoJS.SHA256(data).toString();
}

// ─── CryptoService ───────────────────────────────────────────────────────────

export class CryptoService {

    /**
     * Dynamically initialize the umbral-pre WASM library at runtime.
     * This bypasses Hermes static module evaluation crashes.
     */
    private async initUmbral() {
        if (!umbral) {
            umbral = await import('@nucypher/umbral-pre');
        }
    }

    /**
     * Step 1: Generate a new owner keypair.
     */
    async generateUserKeys(): Promise<UserKeyPair> {
        await this.initUmbral();
        const sk = umbral.SecretKey.random();
        const pk = sk.publicKey();
        return {
            secretKeyB64: toB64(sk.toBEBytes()),
            publicKeyB64: toB64(pk.toCompressedBytes()),
        };
    }

    /**
     * Serialize a SecretKey from base64.
     */
    private skFromB64(b64: string): SecretKey {
        return umbral.SecretKey.fromBEBytes(fromB64(b64));
    }

    /**
     * Serialize a PublicKey from base64 compressed bytes.
     */
    private pkFromB64(b64: string): PublicKey {
        return umbral.PublicKey.fromCompressedBytes(fromB64(b64));
    }

    /**
     * Step 2: Encrypt local data and produce an anchor hash.
     * The data is JSON-serialized with canonical stringify for deterministic hashing.
     */
    async encryptLocalData(
        data: unknown,
        ownerPublicKeyB64: string
    ): Promise<EncryptedPayload> {
        await this.initUmbral();
        const pk = this.pkFromB64(ownerPublicKeyB64);
        const plaintext = new TextEncoder().encode(canonicalStringify(data));
        const [capsule, ciphertext] = umbral.encrypt(pk, plaintext);

        const payload = {
            ciphertextB64: toB64(ciphertext),
            capsuleB64: toB64(capsule.toBytes()),
        };

        // Deterministic hash of the canonical encrypted payload
        const anchorHash = await sha256Hex(canonicalStringify(payload));

        return {
            ...payload,
            anchorHash,
        };
    }

    /**
     * Step 3: Generate a consent key fragment (kFrag) for a recipient.
     * This allows a proxy to re-encrypt data for the recipient without
     * ever seeing the plaintext.
     */
    async generateConsentKFrag(
        ownerSecretKeyB64: string,
        recipientPublicKeyB64: string
    ): Promise<ConsentKFrag> {
        await this.initUmbral();
        const ownerSK = this.skFromB64(ownerSecretKeyB64);
        const recipientPK = this.pkFromB64(recipientPublicKeyB64);
        const signer = new umbral.Signer(ownerSK);

        // M=1, N=1: single threshold, single fragment
        const kfrags = umbral.generateKFrags(
            ownerSK,
            recipientPK,
            signer,
            1,  // threshold
            1,  // shares
            false, // not signing (no pre-verification of capsule authenticity)
            false  // not receiving key (decryptor does not learn the delegating key)
        );

        return {
            kfragB64: toB64(kfrags[0].toBytes()),
            verifyingKeyB64: toB64(signer.verifyingKey().toCompressedBytes()),
        };
    }

    /**
     * Step 4: Proxy re-encrypts a capsule using a kFrag.
     * This is performed by the gateway / proxy node, never by the owner.
     *
     * Note: After serialization/deserialization, kFrags lose their
     * VerifiedKeyFrag status. The proxy uses skipVerification() since
     * it operates in a trusted context (the kFrag was verified at creation).
     */
    async proxyReEncrypt(
        capsuleB64: string,
        kfragB64: string
    ): Promise<ReEncryptedCFrag> {
        await this.initUmbral();
        const capsule = umbral.Capsule.fromBytes(fromB64(capsuleB64));
        const kfrag = umbral.KeyFrag.fromBytes(fromB64(kfragB64));

        // skipVerification() recovers VerifiedKeyFrag status for trusted proxy
        const verifiedKfrag = kfrag.skipVerification();
        const cfrag = umbral.reencrypt(capsule, verifiedKfrag);

        return {
            cfragB64: toB64(cfrag.toBytes()),
        };
    }

    /**
     * Step 5: Owner self-decrypts their own data.
     */
    async decryptOriginalData(
        ownerSecretKeyB64: string,
        capsuleB64: string,
        ciphertextB64: string
    ): Promise<unknown> {
        await this.initUmbral();
        const sk = this.skFromB64(ownerSecretKeyB64);
        const capsule = umbral.Capsule.fromBytes(fromB64(capsuleB64));
        const ciphertext = fromB64(ciphertextB64);

        const plaintext = umbral.decryptOriginal(sk, capsule, ciphertext);
        return JSON.parse(new TextDecoder().decode(plaintext));
    }

    /**
     * Step 6: Recipient decrypts data using cFrags.
     */
    async decryptAsRecipient(
        recipientSecretKeyB64: string,
        ownerPublicKeyB64: string,
        capsuleB64: string,
        cfragB64s: string[],
        ciphertextB64: string,
        verifyingKeyB64: string
    ): Promise<unknown> {
        await this.initUmbral();
        const recipientSK = this.skFromB64(recipientSecretKeyB64);
        const ownerPK = this.pkFromB64(ownerPublicKeyB64);
        const capsule = umbral.Capsule.fromBytes(fromB64(capsuleB64));
        const ciphertext = fromB64(ciphertextB64);
        const recipientPK = recipientSK.publicKey();

        // Reconstruct the verifying key for cfrag verification
        const verifyingKey = this.pkFromB64(verifyingKeyB64);

        // Verify each cFrag before decryption
        // verify() signature: (capsule, verifyingKey, delegatingPK, receivingPK)
        const verifiedCFrags = cfragB64s.map(b64 => {
            const cfrag = umbral.CapsuleFrag.fromBytes(fromB64(b64));
            return cfrag.verify(capsule, verifyingKey, ownerPK, recipientPK);
        });

        const plaintext = umbral.decryptReencrypted(
            recipientSK,
            ownerPK,
            capsule,
            verifiedCFrags,
            ciphertext
        );
        return JSON.parse(new TextDecoder().decode(plaintext));
    }
}
