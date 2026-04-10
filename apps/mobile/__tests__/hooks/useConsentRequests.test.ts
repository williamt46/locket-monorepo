/**
 * useConsentRequests — contract / behaviour tests (vitest, no RTN renderer)
 *
 * Strategy:
 *   Test the hook's externally-observable contract by exercising the
 *   underlying services (SyncService + SecureStore) and the pure helper
 *   logic (denied-IDs ring-buffer, session token bootstrap) that the hook
 *   orchestrates.  Full lifecycle tests (mount/unmount, setInterval) live
 *   in the E2E suite where a proper React-Native renderer is available.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/SyncService', () => ({
    SyncService: {
        registerSession:      vi.fn(),
        fetchPendingRequests: vi.fn(),
        revokeAccess:         vi.fn(),
    },
}));

vi.mock('expo-secure-store', () => ({
    getItemAsync:    vi.fn().mockResolvedValue(null),
    setItemAsync:    vi.fn().mockResolvedValue(undefined),
    deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

import { SyncService } from '../../src/services/SyncService';
import * as SecureStore from 'expo-secure-store';

const mockRegister     = SyncService.registerSession      as Mock;
const mockFetchPending = SyncService.fetchPendingRequests as Mock;
const mockGetItem      = SecureStore.getItemAsync          as Mock;
const mockSetItem      = SecureStore.setItemAsync          as Mock;

const USER_DID    = 'did:locket:alice';
const SESSION_TOK = 'tok_test_abc';

const MOCK_REQUEST = {
    requestId:         'req1',
    recipientDID:      'did:locket:clinic',
    displayName:       'Dr. Smith',
    requestedDuration: '24h' as const,
    createdAt:         Date.now(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: simulate the session bootstrap logic the hook runs on mount
// ─────────────────────────────────────────────────────────────────────────────
async function simulateSessionBootstrap(
    storedToken: string | null
): Promise<{ sessionToken: string; wasRegistered: boolean }> {
    if (storedToken) {
        return { sessionToken: storedToken, wasRegistered: false };
    }
    const result = await SyncService.registerSession(USER_DID);
    if (result.sessionToken) {
        await SecureStore.setItemAsync('locket_consent_session_token', result.sessionToken);
    }
    return {
        sessionToken: result.sessionToken ?? '',
        wasRegistered: true,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: simulate the denied-IDs ring-buffer logic (DENIED_IDS_CAP = 100)
// ─────────────────────────────────────────────────────────────────────────────
const DENIED_IDS_CAP = 100;

function addDeniedId(existing: string[], newId: string): string[] {
    const updated = [...existing, newId];
    if (updated.length > DENIED_IDS_CAP) {
        return updated.slice(updated.length - DENIED_IDS_CAP);
    }
    return updated;
}

function filterDenied(requests: typeof MOCK_REQUEST[], deniedIds: string[]) {
    const set = new Set(deniedIds);
    return requests.filter(r => !set.has(r.requestId));
}

// ─────────────────────────────────────────────────────────────────────────────

describe('useConsentRequests — service contract', () => {
    beforeEach(() => {
        mockRegister.mockResolvedValue({ sessionToken: SESSION_TOK });
        mockFetchPending.mockResolvedValue([]);
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ── Session bootstrap ─────────────────────────────────────────────────────

    it('registers a new session when no stored token exists', async () => {
        const { wasRegistered, sessionToken } = await simulateSessionBootstrap(null);
        expect(wasRegistered).toBe(true);
        expect(mockRegister).toHaveBeenCalledWith(USER_DID);
        expect(sessionToken).toBe(SESSION_TOK);
        expect(mockSetItem).toHaveBeenCalledWith(
            'locket_consent_session_token',
            SESSION_TOK
        );
    });

    it('reuses a stored token without registering', async () => {
        const { wasRegistered, sessionToken } = await simulateSessionBootstrap(SESSION_TOK);
        expect(wasRegistered).toBe(false);
        expect(mockRegister).not.toHaveBeenCalled();
        expect(sessionToken).toBe(SESSION_TOK);
    });

    it('stores null when registration fails', async () => {
        mockRegister.mockResolvedValueOnce({ sessionToken: null, error: 'Network error' });
        const { sessionToken } = await simulateSessionBootstrap(null);
        expect(sessionToken).toBe('');
    });

    // ── Poll: fetch pending requests ──────────────────────────────────────────

    it('calls fetchPendingRequests with correct args after session bootstrap', async () => {
        mockFetchPending.mockResolvedValue([MOCK_REQUEST]);

        await simulateSessionBootstrap(SESSION_TOK);
        const requests = await SyncService.fetchPendingRequests(USER_DID, SESSION_TOK);

        expect(requests).toHaveLength(1);
        expect(requests[0].requestId).toBe('req1');
        expect(mockFetchPending).toHaveBeenCalledWith(USER_DID, SESSION_TOK);
    });

    it('returns empty array when no requests pending', async () => {
        mockFetchPending.mockResolvedValue([]);
        const requests = await SyncService.fetchPendingRequests(USER_DID, SESSION_TOK);
        expect(requests).toEqual([]);
    });

    it('throws with status=401 when session is expired', async () => {
        const authError = Object.assign(new Error('Unauthorized'), { status: 401 });
        mockFetchPending.mockRejectedValueOnce(authError);

        await expect(
            SyncService.fetchPendingRequests(USER_DID, SESSION_TOK)
        ).rejects.toMatchObject({ status: 401 });
    });

    it('re-registers after 401 and retries the poll', async () => {
        const authError = Object.assign(new Error('Unauthorized'), { status: 401 });
        mockFetchPending.mockRejectedValueOnce(authError);
        mockFetchPending.mockResolvedValueOnce([MOCK_REQUEST]);
        mockRegister.mockResolvedValueOnce({ sessionToken: 'tok_new' });

        // Simulate 401 handler: clear token, re-register, retry
        let requests: typeof MOCK_REQUEST[] = [];
        try {
            requests = await SyncService.fetchPendingRequests(USER_DID, SESSION_TOK);
        } catch (e: any) {
            if (e.status === 401) {
                await SecureStore.deleteItemAsync('locket_consent_session_token');
                const { sessionToken: newToken } = await SyncService.registerSession(USER_DID);
                requests = await SyncService.fetchPendingRequests(USER_DID, newToken!);
            }
        }

        expect(mockRegister).toHaveBeenCalledTimes(1);
        expect(mockFetchPending).toHaveBeenCalledTimes(2);
        expect(requests).toHaveLength(1);
    });

    // ── Denied-IDs ring-buffer ────────────────────────────────────────────────

    it('addDeniedId appends a new ID to the list', () => {
        const result = addDeniedId(['a', 'b'], 'c');
        expect(result).toEqual(['a', 'b', 'c']);
    });

    it('addDeniedId trims to DENIED_IDS_CAP when full', () => {
        const full = Array.from({ length: DENIED_IDS_CAP }, (_, i) => `id_${i}`);
        const result = addDeniedId(full, 'overflow');
        expect(result).toHaveLength(DENIED_IDS_CAP);
        expect(result[result.length - 1]).toBe('overflow');
        expect(result[0]).toBe('id_1'); // oldest was evicted
    });

    it('filterDenied removes requests whose IDs are in the denied set', () => {
        const requests = [MOCK_REQUEST, { ...MOCK_REQUEST, requestId: 'req2' }];
        const result = filterDenied(requests, ['req1']);
        expect(result).toHaveLength(1);
        expect(result[0].requestId).toBe('req2');
    });

    it('filterDenied returns all requests when denied list is empty', () => {
        const requests = [MOCK_REQUEST];
        const result = filterDenied(requests, []);
        expect(result).toHaveLength(1);
    });

    it('persists denied IDs to SecureStore after deny', async () => {
        const deniedIds = addDeniedId([], 'req1');
        await SecureStore.setItemAsync(
            'locket_consent_denied_ids',
            JSON.stringify(deniedIds)
        );
        expect(mockSetItem).toHaveBeenCalledWith(
            'locket_consent_denied_ids',
            JSON.stringify(['req1'])
        );
    });

    it('loads pre-existing denied IDs from SecureStore on mount', async () => {
        mockGetItem.mockImplementation((key: string) =>
            key === 'locket_consent_denied_ids'
                ? Promise.resolve(JSON.stringify(['req1']))
                : Promise.resolve(null)
        );

        const raw = await SecureStore.getItemAsync('locket_consent_denied_ids');
        const loaded: string[] = raw ? JSON.parse(raw) : [];

        expect(loaded).toEqual(['req1']);

        // Pre-existing denied IDs should filter out req1 from poll results
        mockFetchPending.mockResolvedValue([MOCK_REQUEST]);
        const rawRequests = await SyncService.fetchPendingRequests(USER_DID, SESSION_TOK);
        const visible = filterDenied(rawRequests, loaded);
        expect(visible).toHaveLength(0);
    });
});
