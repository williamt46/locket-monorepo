/**
 * PRE Shredding Test — Crypto-shredding validation
 *
 * Verifies that data becomes permanently unrecoverable when the wrong
 * key material is used for decryption.
 */
import { describe, it, expect } from 'vitest';
import { CryptoService } from '../src/CryptoService';

describe('PRE Shredding — Wrong Key Material', () => {
    const crypto = new CryptoService();

    it('should throw when decrypting original with wrong secret key', async () => {
        const owner = await crypto.generateUserKeys();
        const wrongKey = await crypto.generateUserKeys();

        const encrypted = await crypto.encryptLocalData(
            { secret: 'data' },
            owner.publicKeyB64
        );

        await expect(
            crypto.decryptOriginalData(
                wrongKey.secretKeyB64,
                encrypted.capsuleB64,
                encrypted.ciphertextB64
            )
        ).rejects.toThrow();
    });

    it('should throw when recipient uses wrong kFrag', async () => {
        const owner = await crypto.generateUserKeys();
        const recipient = await crypto.generateUserKeys();
        const wrongRecipient = await crypto.generateUserKeys();

        const encrypted = await crypto.encryptLocalData(
            { secret: 'data' },
            owner.publicKeyB64
        );

        // Generate kFrag for wrong recipient
        const wrongConsent = await crypto.generateConsentKFrag(
            owner.secretKeyB64,
            wrongRecipient.publicKeyB64
        );

        const reencrypted = await crypto.proxyReEncrypt(
            encrypted.capsuleB64,
            wrongConsent.kfragB64
        );

        // Recipient tries to decrypt with cFrag generated for someone else
        await expect(
            crypto.decryptAsRecipient(
                recipient.secretKeyB64,
                owner.publicKeyB64,
                encrypted.capsuleB64,
                [reencrypted.cfragB64],
                encrypted.ciphertextB64,
                wrongConsent.verifyingKeyB64
            )
        ).rejects.toThrow();
    });

    it('should throw when using a different owner key for re-encryption', async () => {
        const owner = await crypto.generateUserKeys();
        const fakeOwner = await crypto.generateUserKeys();
        const recipient = await crypto.generateUserKeys();

        const encrypted = await crypto.encryptLocalData(
            { secret: 'data' },
            owner.publicKeyB64
        );

        // Generate kFrag with fake owner's key
        const fakeConsent = await crypto.generateConsentKFrag(
            fakeOwner.secretKeyB64,
            recipient.publicKeyB64
        );

        // Proxy re-encrypts — skipVerification() doesn't catch mismatched keys
        const reencrypted = await crypto.proxyReEncrypt(
            encrypted.capsuleB64,
            fakeConsent.kfragB64
        );

        // Decryption should fail because the cFrag was produced
        // from a kFrag that doesn't match the original encryption
        await expect(
            crypto.decryptAsRecipient(
                recipient.secretKeyB64,
                owner.publicKeyB64,
                encrypted.capsuleB64,
                [reencrypted.cfragB64],
                encrypted.ciphertextB64,
                fakeConsent.verifyingKeyB64
            )
        ).rejects.toThrow();
    });
});
