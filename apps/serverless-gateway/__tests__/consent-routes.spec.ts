/**
 * Phase 6.5 — Consent Routes Integration Tests (Vitest)
 *
 * Spins up the Express app in-process, exercises all new Phase 6.5 routes:
 *   POST /api/auth/register
 *   POST /api/consent/request
 *   GET  /api/consent/pending/:userDid
 *   POST /api/consent/revoke/:requestId
 *
 * FabricService is mocked so tests run without a live Fabric network.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// ── Mock FabricService before importing app ───────────────────────────────────
vi.mock('../src/FabricService', () => ({
    FabricService: vi.fn().mockImplementation(() => ({
        connect:       vi.fn().mockResolvedValue(undefined),
        disconnect:    vi.fn().mockResolvedValue(undefined),
        revokeConsent: vi.fn().mockResolvedValue(undefined),
    })),
}));

// ── Import app after mocks are in place ──────────────────────────────────────
import app from '../src/index';

// ─────────────────────────────────────────────────────────────────────────────

const USER_DID   = 'did:locket:test-user-' + Date.now();
const RECIP_DID  = 'did:locket:provider-' + Date.now();
const RECIP_PK   = Buffer.from('mock-recipient-public-key').toString('base64');
let sessionToken = '';
let requestId    = '';

describe('Phase 6.5 Consent Routes', () => {

    // ── POST /api/auth/register ───────────────────────────────────────────────

    describe('POST /api/auth/register', () => {
        it('H3.1 — returns 200 with a sessionToken UUID', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ userDid: USER_DID })
                .expect(200);

            expect(res.body).toHaveProperty('sessionToken');
            expect(typeof res.body.sessionToken).toBe('string');
            expect(res.body.sessionToken.length).toBeGreaterThan(10);
            sessionToken = res.body.sessionToken;
        });

        it('H3.2 — returns 400 when userDid is missing', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({})
                .expect(400);
        });
    });

    // ── POST /api/consent/request ─────────────────────────────────────────────

    describe('POST /api/consent/request', () => {
        it('H3.3 — returns 201 with a requestId for valid payload', async () => {
            const res = await request(app)
                .post('/api/consent/request')
                .send({
                    userDid:              USER_DID,
                    recipientDID:         RECIP_DID,
                    recipientPublicKeyB64: RECIP_PK,
                    displayName:          'Dr. Vitest',
                    requestedDuration:    '24h',
                })
                .expect(201);

            expect(res.body).toHaveProperty('requestId');
            expect(typeof res.body.requestId).toBe('string');
            requestId = res.body.requestId;
        });

        it('H3.4 — accepts all valid ConsentDuration values', async () => {
            for (const dur of ['7d', '30d', 'indefinite']) {
                const res = await request(app)
                    .post('/api/consent/request')
                    .send({
                        userDid:              USER_DID,
                        recipientDID:         RECIP_DID + '-' + dur,
                        recipientPublicKeyB64: RECIP_PK,
                        displayName:          'Dr. Test',
                        requestedDuration:    dur,
                    })
                    .expect(201);

                expect(res.body.requestId).toBeTruthy();
            }
        });

        it('H3.5 — returns 400 for an invalid duration', async () => {
            await request(app)
                .post('/api/consent/request')
                .send({
                    userDid:              USER_DID,
                    recipientDID:         RECIP_DID,
                    recipientPublicKeyB64: RECIP_PK,
                    displayName:          'Dr. Bad',
                    requestedDuration:    '999d',
                })
                .expect(400);
        });

        it('H3.6 — returns 400 when required fields are missing', async () => {
            await request(app)
                .post('/api/consent/request')
                .send({ userDid: USER_DID })
                .expect(400);
        });

        it('H3.7 — evicts oldest entry when 50-per-userDid cap is reached', async () => {
            const capDid = 'did:locket:cap-test-' + Date.now();

            // Register a token for this DID
            const regRes = await request(app)
                .post('/api/auth/register')
                .send({ userDid: capDid })
                .expect(200);

            const capToken = regRes.body.sessionToken;

            // Submit 51 requests
            for (let i = 0; i < 51; i++) {
                await request(app)
                    .post('/api/consent/request')
                    .send({
                        userDid:              capDid,
                        recipientDID:         `did:locket:recip-${i}`,
                        recipientPublicKeyB64: RECIP_PK,
                        displayName:          `Dr. ${i}`,
                        requestedDuration:    '24h',
                    })
                    .expect(201);
            }

            // The map should hold ≤50 entries for this DID
            const listRes = await request(app)
                .get(`/api/consent/pending/${capDid}`)
                .set('Authorization', `Bearer ${capToken}`)
                .expect(200);

            expect(listRes.body.requests.length).toBeLessThanOrEqual(50);
        });
    });

    // ── GET /api/consent/pending/:userDid ─────────────────────────────────────

    describe('GET /api/consent/pending/:userDid', () => {
        it('H3.8 — returns 200 with pending requests for authenticated user', async () => {
            const res = await request(app)
                .get(`/api/consent/pending/${USER_DID}`)
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('requests');
            expect(Array.isArray(res.body.requests)).toBe(true);
            // At least the request we posted in H3.3
            expect(res.body.requests.length).toBeGreaterThanOrEqual(1);
        });

        it('H3.9 — returns 401 when Authorization header is missing', async () => {
            await request(app)
                .get(`/api/consent/pending/${USER_DID}`)
                .expect(401);
        });

        it('H3.10 — returns 401 when token is invalid', async () => {
            await request(app)
                .get(`/api/consent/pending/${USER_DID}`)
                .set('Authorization', 'Bearer totally-fake-token')
                .expect(401);
        });

        it('H3.11 — returns 403 when token belongs to a different DID', async () => {
            // Register a second user
            const otherRes = await request(app)
                .post('/api/auth/register')
                .send({ userDid: 'did:locket:other-user' })
                .expect(200);

            await request(app)
                .get(`/api/consent/pending/${USER_DID}`)
                .set('Authorization', `Bearer ${otherRes.body.sessionToken}`)
                .expect(403);
        });

        it('H3.12 — indefinite requests are included (never expired)', async () => {
            const indDid = 'did:locket:indefinite-test-' + Date.now();
            const regRes = await request(app)
                .post('/api/auth/register')
                .send({ userDid: indDid })
                .expect(200);

            await request(app)
                .post('/api/consent/request')
                .send({
                    userDid:              indDid,
                    recipientDID:         RECIP_DID,
                    recipientPublicKeyB64: RECIP_PK,
                    displayName:          'Indefinite Provider',
                    requestedDuration:    'indefinite',
                })
                .expect(201);

            const listRes = await request(app)
                .get(`/api/consent/pending/${indDid}`)
                .set('Authorization', `Bearer ${regRes.body.sessionToken}`)
                .expect(200);

            const indefiniteEntry = listRes.body.requests.find(
                (r: any) => r.requestedDuration === 'indefinite'
            );
            expect(indefiniteEntry).toBeDefined();
            expect(indefiniteEntry.expiresAt).toBeNull();
        });
    });

    // ── POST /api/consent/revoke/:requestId ───────────────────────────────────

    describe('POST /api/consent/revoke/:requestId', () => {
        it('H3.13 — returns 200 and removes the request from pending list', async () => {
            await request(app)
                .post(`/api/consent/revoke/${requestId}`)
                .set('Authorization', `Bearer ${sessionToken}`)
                .send({ userDid: USER_DID, recipientPublicKeyB64: RECIP_PK })
                .expect(200);

            // Confirm it's gone from pending list
            const listRes = await request(app)
                .get(`/api/consent/pending/${USER_DID}`)
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(200);

            const still = listRes.body.requests.find((r: any) => r.requestId === requestId);
            expect(still).toBeUndefined();
        });

        it('H3.14 — returns 401 when Authorization header is missing', async () => {
            await request(app)
                .post(`/api/consent/revoke/${requestId}`)
                .send({ userDid: USER_DID, recipientPublicKeyB64: RECIP_PK })
                .expect(401);
        });

        it('H3.15 — returns 404 when requestId does not exist', async () => {
            await request(app)
                .post('/api/consent/revoke/req_nonexistent_xyz')
                .set('Authorization', `Bearer ${sessionToken}`)
                .send({ userDid: USER_DID, recipientPublicKeyB64: RECIP_PK })
                .expect(404);
        });
    });

    // ── Health check includes pendingRequests.size ────────────────────────────

    describe('GET /health', () => {
        it('H3.16 — health response includes pendingRequests count', async () => {
            const res = await request(app).get('/health').expect(200);
            expect(res.body).toHaveProperty('pendingRequests');
            expect(typeof res.body.pendingRequests).toBe('number');
        });
    });
});
