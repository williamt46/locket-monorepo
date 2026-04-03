/**
 * Phase 6.5 — Reversed QR Consent
 * useConsentRequests: polls the gateway for pending consent requests,
 * manages session token auth, and maintains local denial tracking.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SyncService } from '../services/SyncService';
import { ConsentRequest } from '../types/ConsentTypes';

const SESSION_TOKEN_KEY = 'locket_consent_session_token';
const DENIED_IDS_KEY    = 'locket_consent_denied_ids';
const POLL_INTERVAL_MS  = 5000; // 5 seconds
const DENIED_IDS_CAP    = 100;  // Ring-buffer cap (SecureStore size limit)

export interface UseConsentRequestsResult {
    pendingRequests: ConsentRequest[];
    isPolling: boolean;
    error: string | null;
    denyRequest: (requestId: string) => Promise<void>;
    refreshNow: () => Promise<void>;
}

export function useConsentRequests(userDid: string | null): UseConsentRequestsResult {
    const [pendingRequests, setPendingRequests] = useState<ConsentRequest[]>([]);
    const [isPolling, setIsPolling]             = useState(false);
    const [error, setError]                     = useState<string | null>(null);

    const sessionTokenRef  = useRef<string | null>(null);
    const deniedIdsRef     = useRef<Set<string>>(new Set());
    const pollTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMountedRef     = useRef(true);
    const isPollingInFlight = useRef(false); // guard against concurrent poll invocations

    // ── Load denied IDs from SecureStore ──────────────────────────────────────
    const loadDeniedIds = useCallback(async () => {
        try {
            const raw = await SecureStore.getItemAsync(DENIED_IDS_KEY);
            if (raw) {
                const parsed: string[] = JSON.parse(raw);
                deniedIdsRef.current = new Set(parsed);
            }
        } catch {
            // Non-fatal — start with empty set
        }
    }, []);

    // ── Persist denied IDs to SecureStore ─────────────────────────────────────
    const persistDeniedIds = useCallback(async (ids: Set<string>) => {
        try {
            let arr = [...ids];
            // Ring-buffer: keep most recent DENIED_IDS_CAP entries
            if (arr.length > DENIED_IDS_CAP) {
                arr = arr.slice(arr.length - DENIED_IDS_CAP);
            }
            await SecureStore.setItemAsync(DENIED_IDS_KEY, JSON.stringify(arr));
        } catch (e) {
            console.warn('[useConsentRequests] Failed to persist deniedIds:', e);
        }
    }, []);

    // ── Ensure valid session token ─────────────────────────────────────────────
    const ensureSessionToken = useCallback(async (did: string): Promise<string | null> => {
        // Try stored token first
        if (!sessionTokenRef.current) {
            try {
                const stored = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
                if (stored) sessionTokenRef.current = stored;
            } catch { /* ignore */ }
        }

        if (sessionTokenRef.current) return sessionTokenRef.current;

        // No stored token — register new session
        const result = await SyncService.registerSession(did);
        if (result.sessionToken) {
            sessionTokenRef.current = result.sessionToken;
            try {
                await SecureStore.setItemAsync(SESSION_TOKEN_KEY, result.sessionToken);
            } catch { /* non-fatal */ }
            return result.sessionToken;
        }

        return null;
    }, []);

    // ── Core poll function ─────────────────────────────────────────────────────
    const poll = useCallback(async () => {
        if (!userDid || !isMountedRef.current) return;
        // Guard: skip if a poll is already in-flight (prevents concurrent fetches on slow connections)
        if (isPollingInFlight.current) return;
        isPollingInFlight.current = true;

        try {
            const token = await ensureSessionToken(userDid);
            if (!token) {
                if (isMountedRef.current) setError('Unable to establish session. Check connection.');
                return;
            }

            const requests = await SyncService.fetchPendingRequests(userDid, token);

            // Filter locally-denied requests
            const filtered = requests.filter(r => !deniedIdsRef.current.has(r.requestId));

            if (isMountedRef.current) {
                setPendingRequests(filtered);
                setError(null);
            }
        } catch (e: any) {
            if (!isMountedRef.current) return;

            if (e?.status === 401) {
                // Token rejected — clear and re-register on next poll
                console.log('[useConsentRequests] 401 — clearing session token, re-registering');
                sessionTokenRef.current = null;
                try { await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY); } catch { /* ignore */ }
            } else {
                setError('Unable to load requests. Check your connection.');
                console.warn('[useConsentRequests] Poll error:', e?.message || e);
            }
        } finally {
            isPollingInFlight.current = false;
        }
    }, [userDid, ensureSessionToken]);

    // ── Mount: load state, register, start polling ─────────────────────────────
    useEffect(() => {
        isMountedRef.current = true;

        if (!userDid) return;

        (async () => {
            await loadDeniedIds();
            setIsPolling(true);

            // Immediate first poll
            await poll();

            // Set up recurring poll
            pollTimerRef.current = setInterval(() => {
                poll();
            }, POLL_INTERVAL_MS);
        })();

        return () => {
            isMountedRef.current = false;
            setIsPolling(false);
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
    }, [userDid, poll, loadDeniedIds]);

    // ── denyRequest: add to local denied set + persist ─────────────────────────
    const denyRequest = useCallback(async (requestId: string) => {
        deniedIdsRef.current.add(requestId);
        await persistDeniedIds(deniedIdsRef.current);
        // Immediately remove from displayed list
        setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
    }, [persistDeniedIds]);

    // ── refreshNow: immediate out-of-band poll ─────────────────────────────────
    const refreshNow = useCallback(async () => {
        await poll();
    }, [poll]);

    return { pendingRequests, isPolling, error, denyRequest, refreshNow };
}
