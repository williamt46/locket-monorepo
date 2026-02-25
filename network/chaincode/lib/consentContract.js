'use strict';

const { Contract } = require('fabric-contract-api');

class ConInSeContract extends Contract {

    /**
     * GrantConsentEvent — Tokenize a consent grant on-chain.
     *
     * Creates a composite key ConInSe~[userDid, recipientPublicKey] and stores:
     *   - kFragBase64: The PRE re-encryption key fragment
     *   - delegatorPublicKeyBase64: The data owner's public key
     *   - verifyingKeyBase64: The owner's verifying key (for cfrag.verify)
     *   - anchorHash: SHA-256 of the encrypted data bundle
     *   - expirationTimestamp: Unix ms after which consent expires
     *   - status: 'ACTIVE'
     *
     * @param {Context} ctx
     * @param {string} userDid           DID of the data owner
     * @param {string} recipientPublicKey Base64 public key of the recipient
     * @param {string} kFragBase64       PRE key fragment (base64)
     * @param {string} delegatorPublicKeyBase64 Owner's public key (base64)
     * @param {string} anchorHash        SHA-256 anchor hash of encrypted data
     * @param {string} expirationTimestamp Unix timestamp (ms) for consent expiry
     * @param {string} verifyingKeyBase64 Owner's verifying key for cfrag verification (base64)
     * @returns {string} JSON of the created consent token
     */
    async GrantConsentEvent(ctx, userDid, recipientPublicKey, kFragBase64, delegatorPublicKeyBase64, anchorHash, expirationTimestamp, verifyingKeyBase64) {
        console.info('============= START : GrantConsentEvent ===========');

        const tokenizedConsent = {
            docType: 'consentToken',
            userDid,
            recipientPublicKey,
            kFragBase64,
            delegatorPublicKeyBase64,
            verifyingKeyBase64,
            anchorHash,
            expirationTimestamp: parseInt(expirationTimestamp),
            status: 'ACTIVE',
            grantedAt: ctx.stub.getTxTimestamp().seconds.low
        };

        const consentKey = ctx.stub.createCompositeKey('ConInSe', [userDid, recipientPublicKey]);
        await ctx.stub.putState(consentKey, Buffer.from(JSON.stringify(tokenizedConsent)));

        console.info('============= END : GrantConsentEvent =============');
        return JSON.stringify(tokenizedConsent);
    }

    /**
     * VerifyConsentEvent — Check if a consent token is valid.
     *
     * Looks up the composite key and checks:
     *   1. Token exists
     *   2. Status is ACTIVE
     *   3. Current Fabric tx timestamp < expirationTimestamp
     *
     * Uses ctx.stub.getTxTimestamp() for authoritative time (Risk R10).
     *
     * @param {Context} ctx
     * @param {string} userDid           DID of the data owner
     * @param {string} recipientPublicKey Base64 public key of the recipient
     * @returns {string} JSON with { valid: boolean, kFragBase64?, delegatorPublicKeyBase64?, reason? }
     */
    async VerifyConsentEvent(ctx, userDid, recipientPublicKey) {
        console.info('============= START : VerifyConsentEvent ===========');

        const consentKey = ctx.stub.createCompositeKey('ConInSe', [userDid, recipientPublicKey]);
        const bytes = await ctx.stub.getState(consentKey);

        if (!bytes || bytes.length === 0) {
            console.info('============= END : VerifyConsentEvent (not found) =============');
            return JSON.stringify({ valid: false, reason: 'Consent token not found' });
        }

        const record = JSON.parse(bytes.toString());

        if (record.status !== 'ACTIVE') {
            console.info('============= END : VerifyConsentEvent (revoked) =============');
            return JSON.stringify({ valid: false, reason: 'Consent revoked' });
        }

        // Use authoritative Fabric timestamp to prevent clock-drift attacks
        const txTimestamp = ctx.stub.getTxTimestamp();
        const nowMs = (txTimestamp.seconds.low * 1000) + Math.floor(txTimestamp.nanos / 1000000);

        if (nowMs > record.expirationTimestamp) {
            console.info('============= END : VerifyConsentEvent (expired) =============');
            return JSON.stringify({ valid: false, reason: 'Consent token expired' });
        }

        console.info('============= END : VerifyConsentEvent (valid) =============');
        return JSON.stringify({
            valid: true,
            kFragBase64: record.kFragBase64,
            delegatorPublicKeyBase64: record.delegatorPublicKeyBase64,
            verifyingKeyBase64: record.verifyingKeyBase64
        });
    }

    /**
     * RevokeConsentEvent — Permanently revoke a consent token.
     *
     * Sets the token status to 'REVOKED'. This is irreversible —
     * a new GrantConsentEvent must be issued to re-enable access.
     *
     * @param {Context} ctx
     * @param {string} userDid           DID of the data owner
     * @param {string} recipientPublicKey Base64 public key of the recipient
     * @returns {string} JSON of the updated consent token
     */
    async RevokeConsentEvent(ctx, userDid, recipientPublicKey) {
        console.info('============= START : RevokeConsentEvent ===========');

        const consentKey = ctx.stub.createCompositeKey('ConInSe', [userDid, recipientPublicKey]);
        const bytes = await ctx.stub.getState(consentKey);

        if (!bytes || bytes.length === 0) {
            throw new Error(`Consent token not found for ${userDid} → ${recipientPublicKey}`);
        }

        const record = JSON.parse(bytes.toString());
        record.status = 'REVOKED';
        record.revokedAt = ctx.stub.getTxTimestamp().seconds.low;

        await ctx.stub.putState(consentKey, Buffer.from(JSON.stringify(record)));

        console.info('============= END : RevokeConsentEvent =============');
        return JSON.stringify(record);
    }
}

module.exports = ConInSeContract;
