/**
 * Locket ConInSe PRE Proxy — Serverless Gateway
 *
 * This Express server acts as a blind proxy for Proxy Re-Encryption.
 * It NEVER sees plaintext health data. It only transforms encrypted
 * capsules using kFrags retrieved from the consent ledger.
 *
 * Routes:
 *   POST /api/auth/register           — Register app session token
 *   POST /api/data/upload             — App uploads base ciphertext
 *   POST /api/consent/request         — Provider/partner requests consent (rate-limited per DID)
 *   GET  /api/consent/pending/:userDid — App polls for pending requests (authenticated)
 *   POST /api/consent/grant           — App records consent on-chain
 *   GET  /api/data/request/:did/:pk   — Provider requests re-encrypted data
 *
 * Compatibility Routes:
 *   POST /api/anchor                  — Legacy single anchor
 *   POST /api/anchor/batch            — Legacy batch anchor
 *   GET  /api/verify/:assetId         — Legacy asset verification
 */

import express from 'express';
import cors from 'cors';
import { FabricService } from './FabricService';
import { ConsentRequestStore, RateLimiter, SessionAuthStore } from './ConsentService';

// CryptoService is loaded dynamically because umbral-pre WASM
// needs async initialization in some environments.
let cryptoService: any;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Consent + Security Services ─────────────────────────────────────────────
const consentStore = new ConsentRequestStore();
const rateLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60 * 60 * 1000 }); // 5 req/hr/DID
const sessionAuth = new SessionAuthStore();


// ─── Ephemeral Storage ───────────────────────────────────────────────────────
// Maps userDid → { ciphertextB64, capsuleB64 }
// In production, this would be replaced by encrypted blob storage.
const storage = new Map<string, { ciphertextB64: string; capsuleB64: string }>();

// ─── Fabric Connection ───────────────────────────────────────────────────────
const fabric = new FabricService();

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * App registers a session token for authenticated polling.
 */
app.post('/api/auth/register', (req, res) => {
    const { userDid } = req.body;
    if (!userDid) {
        return res.status(400).json({ error: 'Missing required field: userDid' });
    }
    const token = sessionAuth.register(userDid);
    console.log(`[Gateway] Session registered for ${userDid}`);
    return res.status(201).json({ token });
});

/**
 * POST /api/consent/request
 * Provider/partner submits a consent request. Rate-limited per recipientDID.
 */
app.post('/api/consent/request', (req, res) => {
    const { userDID, recipientDID, recipientPublicKeyB64, displayName } = req.body;

    if (!userDID || !recipientDID || !recipientPublicKeyB64) {
        return res.status(400).json({ error: 'Missing required fields: userDID, recipientDID, recipientPublicKeyB64' });
    }

    // Per-DID rate limiting
    if (!rateLimiter.isAllowed(recipientDID)) {
        console.log(`[Gateway] Rate limited: ${recipientDID}`);
        return res.status(429).json({ error: 'Too many consent requests from this DID. Try again later.' });
    }
    rateLimiter.record(recipientDID);

    consentStore.addRequest({ userDID, recipientDID, recipientPublicKeyB64, displayName });
    console.log(`[Gateway] Consent request from ${recipientDID} for ${userDID}`);
    return res.status(201).json({ status: 'Consent request submitted' });
});

/**
 * GET /api/consent/pending/:userDid
 * App polls for pending consent requests. Requires session token auth.
 */
app.get('/api/consent/pending/:userDid', (req, res) => {
    const { userDid } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7);
    const authenticatedDid = sessionAuth.validate(token);

    if (!authenticatedDid || authenticatedDid !== userDid) {
        return res.status(401).json({ error: 'Invalid session token' });
    }

    const pending = consentStore.getPending(userDid);
    return res.json({ pending });
});


/**
 * POST /api/data/upload
 * App uploads base ciphertext + capsule after local encryption (PRE Step 2).
 */
app.post('/api/data/upload', (req, res) => {
    const { userDid, ciphertextB64, capsuleB64, anchorHash } = req.body;

    if (!userDid || !ciphertextB64 || !capsuleB64) {
        return res.status(400).json({ error: 'Missing required fields: userDid, ciphertextB64, capsuleB64' });
    }

    storage.set(userDid, { ciphertextB64, capsuleB64 });
    console.log(`[Gateway] Data uploaded for ${userDid} (anchorHash: ${anchorHash?.substring(0, 12)}...)`);

    return res.status(201).json({ status: 'Data Anchored' });
});

/**
 * POST /api/consent/grant
 * App submits consent + kFrag for a provider → recorded on-chain.
 */
app.post('/api/consent/grant', async (req, res) => {
    const {
        userDid,
        recipientPublicKey,
        kFragBase64,
        delegatorPublicKeyBase64,
        anchorHash,
        durationMinutes = 30,
        verifyingKeyBase64
    } = req.body;

    if (!userDid || !recipientPublicKey || !kFragBase64 || !delegatorPublicKeyBase64 || !verifyingKeyBase64) {
        return res.status(400).json({
            error: 'Missing required fields: userDid, recipientPublicKey, kFragBase64, delegatorPublicKeyBase64, verifyingKeyBase64'
        });
    }

    try {
        await fabric.recordConsentEvent(
            userDid,
            recipientPublicKey,
            kFragBase64,
            delegatorPublicKeyBase64,
            anchorHash || '',
            durationMinutes,
            verifyingKeyBase64
        );
        return res.status(201).json({ status: 'ConInSe Consent Token Generated' });
    } catch (e: any) {
        console.error('[Gateway] consent/grant error:', e.message);
        return res.status(500).json({ error: 'An internal error occurred while processing the request.' });
    }
});

/**
 * GET /api/data/request/:userDid/:recipientPublicKey
 * Provider requests data → Gateway verifies consent on-chain,
 * performs blind PRE re-encryption (Step 4), returns cFrag.
 */
app.get('/api/data/request/:userDid/:recipientPublicKey', async (req, res) => {
    const { userDid, recipientPublicKey } = req.params;

    try {
        // 1. ConInSe Verification (on-chain query)
        const consent = await fabric.verifyConsentEvent(userDid, recipientPublicKey);
        if (!consent.valid) {
            console.log(`[Gateway] Consent denied for ${userDid}: ${consent.reason}`);
            return res.status(403).json({ error: consent.reason });
        }

        // 2. Retrieve uploaded ciphertext
        const data = storage.get(userDid);
        if (!data) {
            return res.status(404).json({ error: 'Data unavailable for this DID.' });
        }

        // 3. Proxy Re-Encryption (PRE Step 4) — blind capsule transformation
        const { cfragB64 } = cryptoService.proxyReEncrypt(
            data.capsuleB64,
            consent.kFragBase64!
        );

        console.log(`[Gateway] PRE re-encryption complete for ${userDid}`);

        // 4. Return re-encrypted payload
        return res.json({
            ciphertextB64: data.ciphertextB64,
            capsuleB64: data.capsuleB64,
            cfragB64,
            delegatorPublicKeyB64: consent.delegatorPublicKeyBase64,
            verifyingKeyB64: consent.verifyingKeyBase64
        });
    } catch (e: any) {
        console.error('[Gateway] data/request error:', e.message);
        return res.status(500).json({ error: 'An internal error occurred while processing the request.' });
    }
});

/**
 * Compatibility: POST /api/anchor
 * Legacy single anchor support.
 */
app.post('/api/anchor', async (req, res) => {
    const { userDID, dataHash } = req.body;
    try {
        const txId = await fabric.createAsset(userDID, dataHash);
        return res.status(201).json({ txId, assetId: `anchor_${Date.now()}` }); // Note: actual ID generated in FabricService
    } catch (e: any) {
        console.error('[Gateway] anchor error:', e.message);
        return res.status(500).json({ error: 'An internal error occurred while processing the request.' });
    }
});

/**
 * Compatibility: POST /api/anchor/batch
 * Legacy batch anchor support.
 */
app.post('/api/anchor/batch', async (req, res) => {
    const { assets } = req.body;
    try {
        const resultJSON = await fabric.createAssetBatch(assets);
        const results = JSON.parse(resultJSON);
        return res.status(201).json({ status: 'Batch Anchored', results });
    } catch (e: any) {
        console.error('[Gateway] anchor/batch error:', e.message);
        return res.status(500).json({ error: 'An internal error occurred while processing the request.' });
    }
});

/**
 * Compatibility: GET /api/verify/:assetId
 * Legacy verification support.
 */
app.get('/api/verify/:assetId', async (req, res) => {
    const { assetId } = req.params;
    try {
        const asset = await fabric.readAsset(assetId);
        return res.json(asset);
    } catch (e: any) {
        console.error('[Gateway] verify error:', e.message);
        return res.status(404).json({ error: 'Resource not found.' });
    }
});

/**
 * GET /health
 * Simple health check.
 */
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', storage: storage.size });
});

// ─── Startup ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
    // Load CryptoService (WASM needs to initialize)
    try {
        const cryptoModule = await import('@locket/crypto-engine');
        // Handle ESM/CJS interop — named exports may be at top level or under .default
        const CryptoServiceClass = cryptoModule.CryptoService || (cryptoModule as any).default?.CryptoService;
        cryptoService = new CryptoServiceClass();
        if (typeof cryptoService.proxyReEncrypt !== 'function') {
            throw new Error('cryptoService.proxyReEncrypt not found — check module exports');
        }
        console.log('[Gateway] CryptoService loaded ✓');
    } catch (e: any) {
        console.error('[Gateway] Failed to load CryptoService:', e.message);
        process.exit(1);
    }

    // Connect to Fabric peer
    try {
        await fabric.connect();
    } catch (e: any) {
        console.error('[Gateway] Failed to connect to Fabric:', e.message);
        process.exit(1);
    }

    // Start Express server
    app.listen(PORT, () => {
        console.log(`\n🔒 ConInSe PRE Proxy running on http://localhost:${PORT}`);
        console.log(`   Routes:`);
        console.log(`     POST /api/auth/register`);
        console.log(`     POST /api/data/upload`);
        console.log(`     POST /api/consent/request  (rate-limited per DID)`);
        console.log(`     GET  /api/consent/pending/:userDid (authenticated)`);
        console.log(`     POST /api/consent/grant`);
        console.log(`     GET  /api/data/request/:userDid/:recipientPublicKey`);
        console.log(`     POST /api/anchor/batch (Legacy)`);
        console.log(`     GET  /health\n`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[Gateway] Shutting down...');
        fabric.disconnect();
        process.exit(0);
    });
}

start();
