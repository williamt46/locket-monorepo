/**
 * Locket ConInSe PRE Proxy — Serverless Gateway
 *
 * This Express server acts as a blind proxy for Proxy Re-Encryption.
 * It NEVER sees plaintext health data. It only transforms encrypted
 * capsules using kFrags retrieved from the consent ledger.
 *
 * Routes:
 *   POST /api/data/upload               — App uploads base ciphertext
 *   POST /api/consent/grant             — App records consent on-chain
 *   GET  /api/data/request/:did/:pk     — Provider requests re-encrypted data
 *   POST /api/auth/register             — Issue session token for polling auth
 *   POST /api/consent/request           — Portal submits pending consent request
 *   GET  /api/consent/pending/:userDid  — App polls pending requests (auth required)
 *   POST /api/consent/revoke/:requestId — Revoke consent + log on-chain
 *
 * Compatibility Routes:
 *   POST /api/anchor                — Legacy single anchor
 *   POST /api/anchor/batch          — Legacy batch anchor
 *   GET  /api/verify/:assetId       — Legacy asset verification
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as crypto from 'crypto';
import { FabricService } from './FabricService';

// CryptoService is loaded dynamically because umbral-pre WASM
// needs async initialization in some environments.
let cryptoService: any;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Security Middleware ─────────────────────────────────────────────────────
// Rate limiter to prevent DoS attacks on the API gateway
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);


// ─── Ephemeral Storage ───────────────────────────────────────────────────────
// Maps userDid → { ciphertextB64, capsuleB64 }
// In production, this would be replaced by encrypted blob storage.
const storage = new Map<string, { ciphertextB64: string; capsuleB64: string }>();

// ─── Phase 6.5 — Reversed QR Consent State ───────────────────────────────────

interface PendingConsentRequest {
    requestId: string;
    userDid: string;
    recipientDID: string;
    recipientPublicKeyB64: string;
    displayName: string;
    requestedDuration: '24h' | '7d' | '30d' | 'indefinite';
    createdAt: number;
    expiresAt: number | null; // epoch ms — null for indefinite
}

const VALID_DURATIONS = new Set(['24h', '7d', '30d', 'indefinite']);
const DURATION_MS: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d':   7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
};

// pendingRequests: requestId → PendingConsentRequest
// Eviction: max 200 entries per userDid to prevent unbounded growth.
const pendingRequests = new Map<string, PendingConsentRequest>();

// sessionTokens: token → { userDid, issuedAt }
const sessionTokens = new Map<string, { userDid: string; issuedAt: number }>();

// requestLog: append-only audit log of consent request actions
const requestLog: { ts: number; action: string; userDid?: string; recipientDID?: string }[] = [];

// ─── Fabric Connection ───────────────────────────────────────────────────────
const fabric = new FabricService();

// ─── Routes ──────────────────────────────────────────────────────────────────

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

// ─── Phase 6.5 Routes ────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Issue a UUID session token for a userDid.
 * Used by the mobile app to authenticate polling requests.
 */
app.post('/api/auth/register', (req, res) => {
    const { userDid } = req.body;
    if (!userDid || typeof userDid !== 'string') {
        return res.status(400).json({ error: 'Missing required field: userDid' });
    }

    // Cap sessionTokens at 10,000 entries — evict oldest to prevent unbounded growth
    if (sessionTokens.size >= 10_000) {
        const oldestKey = sessionTokens.keys().next().value;
        if (oldestKey) sessionTokens.delete(oldestKey);
    }

    const sessionToken = crypto.randomUUID();
    sessionTokens.set(sessionToken, { userDid, issuedAt: Date.now() });

    console.log(`[Gateway] Session token issued for ${userDid}`);
    return res.status(200).json({ sessionToken });
});

/**
 * POST /api/consent/request
 * Provider / partner portal submits a consent request for a patient.
 * Stores in pendingRequests Map (evicts oldest per-userDid over limit).
 */
app.post('/api/consent/request', (req, res) => {
    const { userDid, recipientDID, recipientPublicKeyB64, displayName, requestedDuration } = req.body;

    if (!userDid || !recipientDID || !recipientPublicKeyB64 || !displayName || !requestedDuration) {
        return res.status(400).json({
            error: 'Missing required fields: userDid, recipientDID, recipientPublicKeyB64, displayName, requestedDuration'
        });
    }

    if (!VALID_DURATIONS.has(requestedDuration)) {
        return res.status(400).json({
            error: `Invalid requestedDuration. Must be one of: ${[...VALID_DURATIONS].join(', ')}`
        });
    }

    // Validate recipientPublicKeyB64: must be valid base64, max 512 chars (prevents oversized payloads)
    const B64_RE = /^[A-Za-z0-9+/]+=*$/;
    if (
        typeof recipientPublicKeyB64 !== 'string' ||
        recipientPublicKeyB64.length === 0 ||
        recipientPublicKeyB64.length > 512 ||
        !B64_RE.test(recipientPublicKeyB64)
    ) {
        return res.status(400).json({ error: 'Invalid recipientPublicKeyB64: must be non-empty base64, max 512 chars' });
    }

    // Eviction: cap at 50 pending requests per userDid
    const userPending = [...pendingRequests.values()].filter(r => r.userDid === userDid);
    if (userPending.length >= 50) {
        // Evict the oldest entry for this userDid
        const oldest = userPending.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
        pendingRequests.delete(oldest.requestId);
        console.log(`[Gateway] Evicted oldest pending request for ${userDid} (cap: 50)`);
    }

    const requestId = crypto.randomUUID();
    const createdAt = Date.now();
    const expiresAt = requestedDuration === 'indefinite'
        ? null
        : createdAt + DURATION_MS[requestedDuration];

    pendingRequests.set(requestId, {
        requestId,
        userDid,
        recipientDID,
        recipientPublicKeyB64,
        displayName,
        requestedDuration,
        createdAt,
        expiresAt,
    });

    // Cap requestLog at 1,000 entries
    if (requestLog.length >= 1000) requestLog.shift();
    requestLog.push({ ts: createdAt, action: 'consent_request', userDid, recipientDID });
    console.log(`[Gateway] Consent request stored: ${requestId} (duration: ${requestedDuration})`);

    return res.status(201).json({ requestId });
});

/**
 * GET /api/consent/pending/:userDid
 * Returns pending consent requests for a user.
 * Requires Authorization: Bearer <sessionToken> header.
 * The token's userDid must match the URL param (prevents metadata leakage).
 */
app.get('/api/consent/pending/:userDid', (req, res) => {
    const { userDid } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.slice(7);
    const session = sessionTokens.get(token);

    if (!session || session.userDid !== userDid) {
        return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    const now = Date.now();
    const pending = [...pendingRequests.values()].filter(r => {
        if (r.userDid !== userDid) return false;
        // Indefinite requests (expiresAt === null) never expire until revoked
        if (r.expiresAt === null) return true;
        return r.expiresAt > now;
    });

    return res.json({ requests: pending });
});

/**
 * POST /api/consent/revoke/:requestId
 * Remove a pending request and log revocation on-chain.
 * Requires session token auth.
 */
app.post('/api/consent/revoke/:requestId', async (req, res) => {
    const { requestId } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.slice(7);
    const session = sessionTokens.get(token);

    if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    const request = pendingRequests.get(requestId);
    if (!request) {
        return res.status(404).json({ error: 'Consent request not found' });
    }

    if (request.userDid !== session.userDid) {
        return res.status(403).json({ error: 'Not authorized to revoke this request' });
    }

    // Log on-chain FIRST — if Fabric fails, return an error rather than silently
    // removing from in-memory state while the ledger still shows consent as active.
    try {
        await fabric.revokeConsent(request.userDid, request.recipientPublicKeyB64);
    } catch (e: any) {
        console.error('[Gateway] RevokeConsentEvent failed:', e.message);
        return res.status(502).json({
            error: 'Revocation could not be confirmed on the consent ledger. Please try again.',
        });
    }

    // Remove from pending Map only after successful on-chain write
    pendingRequests.delete(requestId);

    if (requestLog.length >= 1000) requestLog.shift();
    requestLog.push({
        ts: Date.now(),
        action: 'consent_revoke',
        userDid: request.userDid,
        recipientDID: request.recipientDID
    });

    console.log(`[Gateway] Consent revoked: ${requestId}`);
    return res.status(200).json({ revoked: true });
});

/**
 * GET /health
 * Simple health check.
 */
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', storage: storage.size, pendingRequests: pendingRequests.size });
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
        console.log(`     POST /api/data/upload`);
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
