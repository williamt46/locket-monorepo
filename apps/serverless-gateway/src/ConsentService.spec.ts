import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * TDD RED tests for Phase 6.5 Gateway Consent Routes
 *
 * These tests validate:
 *  - POST /api/consent/request (stores pending, rate-limited per recipientDID)
 *  - GET /api/consent/pending/:userDid (authenticated, deduped)
 *  - POST /api/auth/register (issues session token)
 *  - Per-DID rate limiting (5 req/hr/DID on consent/request)
 */

// We will test the consent logic as a standalone module,
// not the full Express app, to keep tests fast and isolated.
import {
    ConsentRequestStore,
    RateLimiter,
    SessionAuthStore
} from './ConsentService';

describe('ConsentRequestStore', () => {
    let store: ConsentRequestStore;

    beforeEach(() => {
        store = new ConsentRequestStore();
    });

    it('should store a consent request and retrieve it by userDid', () => {
        store.addRequest({
            userDID: 'did:locket:user1',
            recipientDID: 'did:locket:clinic1',
            recipientPublicKeyB64: 'pk_base64_clinic1',
            displayName: 'St. Jude Hospital',
        });

        const pending = store.getPending('did:locket:user1');
        expect(pending).toHaveLength(1);
        expect(pending[0].recipientDID).toBe('did:locket:clinic1');
        expect(pending[0].displayName).toBe('St. Jude Hospital');
        expect(pending[0].requestedAt).toBeDefined();
    });

    it('should return empty array for unknown userDid', () => {
        const pending = store.getPending('did:locket:unknown');
        expect(pending).toEqual([]);
    });

    it('should deduplicate requests from same recipientDID (keep latest)', () => {
        store.addRequest({
            userDID: 'did:locket:user1',
            recipientDID: 'did:locket:clinic1',
            recipientPublicKeyB64: 'pk1',
            displayName: 'First Request',
        });

        store.addRequest({
            userDID: 'did:locket:user1',
            recipientDID: 'did:locket:clinic1',
            recipientPublicKeyB64: 'pk1',
            displayName: 'Updated Request',
        });

        const pending = store.getPending('did:locket:user1');
        expect(pending).toHaveLength(1);
        expect(pending[0].displayName).toBe('Updated Request');
    });

    it('should store multiple requests from different recipientDIDs', () => {
        store.addRequest({
            userDID: 'did:locket:user1',
            recipientDID: 'did:locket:clinic1',
            recipientPublicKeyB64: 'pk1',
            displayName: 'Clinic 1',
        });

        store.addRequest({
            userDID: 'did:locket:user1',
            recipientDID: 'did:locket:partner1',
            recipientPublicKeyB64: 'pk2',
            displayName: 'Partner 1',
        });

        const pending = store.getPending('did:locket:user1');
        expect(pending).toHaveLength(2);
    });

    it('should remove pending requests for a userDid after consumption', () => {
        store.addRequest({
            userDID: 'did:locket:user1',
            recipientDID: 'did:locket:clinic1',
            recipientPublicKeyB64: 'pk1',
            displayName: 'Clinic',
        });

        store.removeRequest('did:locket:user1', 'did:locket:clinic1');
        const pending = store.getPending('did:locket:user1');
        expect(pending).toHaveLength(0);
    });
});

describe('RateLimiter (per-DID)', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        limiter = new RateLimiter({ maxRequests: 5, windowMs: 60 * 60 * 1000 }); // 5/hr
    });

    it('should allow requests under the limit', () => {
        for (let i = 0; i < 5; i++) {
            expect(limiter.isAllowed('did:locket:clinic1')).toBe(true);
            limiter.record('did:locket:clinic1');
        }
    });

    it('should block the 6th request from the same DID within the window', () => {
        for (let i = 0; i < 5; i++) {
            limiter.record('did:locket:clinic1');
        }
        expect(limiter.isAllowed('did:locket:clinic1')).toBe(false);
    });

    it('should allow requests from different DIDs independently', () => {
        for (let i = 0; i < 5; i++) {
            limiter.record('did:locket:clinic1');
        }
        expect(limiter.isAllowed('did:locket:clinic2')).toBe(true);
    });

    it('should allow requests after the window expires', () => {
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now);

        for (let i = 0; i < 5; i++) {
            limiter.record('did:locket:clinic1');
        }
        expect(limiter.isAllowed('did:locket:clinic1')).toBe(false);

        // Fast-forward past the window
        vi.spyOn(Date, 'now').mockReturnValue(now + 60 * 60 * 1000 + 1);
        expect(limiter.isAllowed('did:locket:clinic1')).toBe(true);

        vi.restoreAllMocks();
    });
});

describe('SessionAuthStore', () => {
    let auth: SessionAuthStore;

    beforeEach(() => {
        auth = new SessionAuthStore();
    });

    it('should register a user and return a session token', () => {
        const token = auth.register('did:locket:user1');
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
    });

    it('should validate a valid token and return the userDid', () => {
        const token = auth.register('did:locket:user1');
        const userDid = auth.validate(token);
        expect(userDid).toBe('did:locket:user1');
    });

    it('should return null for an invalid token', () => {
        const userDid = auth.validate('bad-token');
        expect(userDid).toBeNull();
    });

    it('should return the same token for a repeat registration', () => {
        const token1 = auth.register('did:locket:user1');
        const token2 = auth.register('did:locket:user1');
        expect(token1).toBe(token2);
    });
});
