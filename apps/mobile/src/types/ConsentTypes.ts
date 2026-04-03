/**
 * Phase 6.5 — Reversed QR Consent
 * Type definitions shared across consent services, hooks, and UI.
 */

export type ConsentDuration = '24h' | '7d' | '30d' | 'indefinite';

export interface ConsentRequest {
  requestId: string;
  recipientDID: string;
  recipientPublicKeyB64: string;
  displayName: string;
  requestedDuration: ConsentDuration;
  createdAt: number; // epoch ms
}

export interface ActiveConsent {
  recipientDID: string;
  displayName: string;
  expiresAt: number | null; // epoch ms, null = indefinite (no expiry)
  recipientPublicKeyB64: string;
}
