/**
 * PRE Workflow Test — Full 6-step happy path
 *
 * Owner encrypts → owner decrypts → generates kFrag → proxy re-encrypts →
 * recipient decrypts with verified cFrag.
 */
import { describe, it, expect } from 'vitest';
import { CryptoService } from '../src/CryptoService';

describe('PRE Workflow — Full 6-Step Happy Path', () => {
    const crypto = new CryptoService();

    it('should complete the full PRE round-trip', async () => {
        // Step 1: Generate owner and recipient keys
        const owner = crypto.generateUserKeys();
        const recipient = crypto.generateUserKeys();

        expect(owner.secretKeyB64).toBeTruthy();
        expect(owner.publicKeyB64).toBeTruthy();
        expect(recipient.secretKeyB64).toBeTruthy();
        expect(recipient.publicKeyB64).toBeTruthy();

        // Step 2: Owner encrypts local data
        const testData = {
            type: 'period',
            startDate: '2026-02-01',
            endDate: '2026-02-05',
            flow: 'medium',
        };
        const encrypted = await crypto.encryptLocalData(testData, owner.publicKeyB64);

        expect(encrypted.ciphertextB64).toBeTruthy();
        expect(encrypted.capsuleB64).toBeTruthy();
        expect(encrypted.anchorHash).toMatch(/^0x[a-f0-9]{64}$/);

        // Step 3: Owner self-decrypts
        const ownerDecrypted = crypto.decryptOriginalData(
            owner.secretKeyB64,
            encrypted.capsuleB64,
            encrypted.ciphertextB64
        );
        expect(ownerDecrypted).toEqual(testData);

        // Step 4: Owner generates consent kFrag for recipient
        const consent = crypto.generateConsentKFrag(
            owner.secretKeyB64,
            recipient.publicKeyB64
        );
        expect(consent.kfragB64).toBeTruthy();
        expect(consent.verifyingKeyB64).toBeTruthy();

        // Step 5: Proxy re-encrypts
        const reencrypted = crypto.proxyReEncrypt(
            encrypted.capsuleB64,
            consent.kfragB64
        );
        expect(reencrypted.cfragB64).toBeTruthy();

        // Step 6: Recipient decrypts
        const recipientDecrypted = crypto.decryptAsRecipient(
            recipient.secretKeyB64,
            owner.publicKeyB64,
            encrypted.capsuleB64,
            [reencrypted.cfragB64],
            encrypted.ciphertextB64,
            consent.verifyingKeyB64
        );
        expect(recipientDecrypted).toEqual(testData);
    });

    it('should return base64-encoded values in all outputs', async () => {
        const keys = crypto.generateUserKeys();

        // Base64 should decode without error
        const skBytes = Buffer.from(keys.secretKeyB64, 'base64');
        const pkBytes = Buffer.from(keys.publicKeyB64, 'base64');

        expect(skBytes.length).toBeGreaterThan(0);
        expect(pkBytes.length).toBe(33); // compressed secp256k1 pubkey
    });
});
