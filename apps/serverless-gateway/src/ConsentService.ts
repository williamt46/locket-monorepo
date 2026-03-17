/**
 * ConsentService — Consent Request Management for the Reversed QR Flow
 *
 * Three standalone classes, easy to unit test independently of Express:
 *  - ConsentRequestStore: in-memory pending request storage (deduped by recipientDID)
 *  - RateLimiter: per-DID rate limiting with configurable window
 *  - SessionAuthStore: simple bearer token ↔ userDid mapping
 */

import * as crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConsentRequest {
    userDID: string;
    recipientDID: string;
    recipientPublicKeyB64: string;
    displayName?: string;
    requestedAt?: number;
}

// ─── ConsentRequestStore ─────────────────────────────────────────────────────

export class ConsentRequestStore {
    // Map<userDID, ConsentRequest[]>
    private pending = new Map<string, ConsentRequest[]>();

    addRequest(req: ConsentRequest): void {
        const { userDID, recipientDID } = req;
        const existing = this.pending.get(userDID) || [];

        // Deduplicate: remove previous request from same recipientDID
        const filtered = existing.filter(r => r.recipientDID !== recipientDID);

        filtered.push({
            ...req,
            requestedAt: Date.now(),
        });

        this.pending.set(userDID, filtered);
    }

    getPending(userDID: string): ConsentRequest[] {
        return this.pending.get(userDID) || [];
    }

    removeRequest(userDID: string, recipientDID: string): void {
        const existing = this.pending.get(userDID);
        if (!existing) return;

        const filtered = existing.filter(r => r.recipientDID !== recipientDID);
        if (filtered.length === 0) {
            this.pending.delete(userDID);
        } else {
            this.pending.set(userDID, filtered);
        }
    }
}

// ─── RateLimiter (per-DID) ───────────────────────────────────────────────────

export interface RateLimiterConfig {
    maxRequests: number;
    windowMs: number;
}

export class RateLimiter {
    private config: RateLimiterConfig;
    // Map<recipientDID, timestamp[]>
    private requests = new Map<string, number[]>();

    constructor(config: RateLimiterConfig) {
        this.config = config;
    }

    isAllowed(did: string): boolean {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        const timestamps = (this.requests.get(did) || []).filter(t => t > windowStart);

        return timestamps.length < this.config.maxRequests;
    }

    record(did: string): void {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        const timestamps = (this.requests.get(did) || []).filter(t => t > windowStart);

        timestamps.push(now);
        this.requests.set(did, timestamps);
    }
}

// ─── SessionAuthStore ────────────────────────────────────────────────────────

export class SessionAuthStore {
    // Map<token, userDid>
    private tokenToUser = new Map<string, string>();
    // Map<userDid, token> (reverse lookup for idempotent registration)
    private userToToken = new Map<string, string>();

    register(userDid: string): string {
        // Idempotent: return existing token if already registered
        const existing = this.userToToken.get(userDid);
        if (existing) return existing;

        const token = crypto.randomUUID();
        this.tokenToUser.set(token, userDid);
        this.userToToken.set(userDid, token);
        return token;
    }

    validate(token: string): string | null {
        return this.tokenToUser.get(token) || null;
    }
}
