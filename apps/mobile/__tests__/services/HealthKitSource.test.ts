import { describe, it, expect, vi } from 'vitest';

// The library is statically imported by HealthKitSource.ts; mock the module id so
// no native code loads. Tests inject a mock HealthKitClient, so these stubs are
// never actually called — the mock exists only to satisfy the import.
vi.mock('@kingstinct/react-native-healthkit', () => ({
    default: {},
    isHealthDataAvailable: vi.fn(() => true),
    getRequestStatusForAuthorization: vi.fn(async () => 2),
    requestAuthorization: vi.fn(async () => true),
    queryCategorySamples: vi.fn(async () => []),
    queryQuantitySamples: vi.fn(async () => []),
}));

import {
    HealthKitSource,
    REPRODUCTIVE_CATEGORY_TYPES,
    BBT_QUANTITY_TYPE,
    type HealthKitClient,
    type HealthKitCategorySample,
} from '../../src/services/HealthKitSource';

function catSample(categoryType: string, date: Date): HealthKitCategorySample {
    return { categoryType, value: 3, startDate: date, endDate: date };
}

function makeClient(overrides: Partial<HealthKitClient> = {}): HealthKitClient {
    return {
        isHealthDataAvailable: () => true,
        getRequestStatusForAuthorization: async () => 2,
        requestAuthorization: async () => true,
        queryCategorySamples: async () => [],
        queryQuantitySamples: async () => [],
        ...overrides,
    };
}

describe('HealthKitSource — availability & permission state', () => {
    it('reports unavailable when health data is not available', async () => {
        const src = new HealthKitSource(makeClient({ isHealthDataAvailable: () => false }));
        expect(src.isAvailable()).toBe(false);
        expect(await src.getPermissionState()).toBe('unavailable');
    });

    it('reports not-determined when the OS says shouldRequest (1)', async () => {
        const src = new HealthKitSource(makeClient({ getRequestStatusForAuthorization: async () => 1 }));
        expect(await src.getPermissionState()).toBe('not-determined');
    });

    it('reports requested when the OS says unnecessary (2) — grant stays opaque', async () => {
        const src = new HealthKitSource(makeClient({ getRequestStatusForAuthorization: async () => 2 }));
        expect(await src.getPermissionState()).toBe('requested');
    });
});

describe('HealthKitSource — read-only authorization payload', () => {
    it('requests only read types (never toShare) covering menstrualFlow + BBT', async () => {
        const requestAuthorization = vi.fn(async () => true);
        const src = new HealthKitSource(makeClient({ requestAuthorization }));
        await src.requestPermission();

        expect(requestAuthorization).toHaveBeenCalledTimes(1);
        const payload = (requestAuthorization.mock.calls[0] as any[])[0] as any;
        expect('toShare' in payload).toBe(false);
        expect(payload.toRead).toContain('HKCategoryTypeIdentifierMenstrualFlow');
        expect(payload.toRead).toContain(BBT_QUANTITY_TYPE);
        // Every reproductive category type is requested.
        for (const t of REPRODUCTIVE_CATEGORY_TYPES) expect(payload.toRead).toContain(t);
    });
});

describe('HealthKitSource — query', () => {
    it('zero samples is NEVER an error — reports ambiguous-zero', async () => {
        const src = new HealthKitSource(makeClient());
        const result = await src.query();
        expect(result.permissionState).toBe('ambiguous-zero');
        expect(result.categorySamples).toEqual([]);
        expect(result.quantitySamples).toEqual([]);
        expect(result.truncation).toBeNull();
    });

    it('returns available and sorts samples ts-ascending across types', async () => {
        const client = makeClient({
            queryCategorySamples: async (identifier: string) => {
                if (identifier === 'HKCategoryTypeIdentifierMenstrualFlow') {
                    return [
                        catSample(identifier, new Date(2024, 0, 10)),
                        catSample(identifier, new Date(2024, 0, 3)),
                    ];
                }
                if (identifier === 'HKCategoryTypeIdentifierSexualActivity') {
                    return [catSample(identifier, new Date(2024, 0, 5))];
                }
                return [];
            },
        });
        const src = new HealthKitSource(client);
        const result = await src.query();
        expect(result.permissionState).toBe('available');
        const days = result.categorySamples.map(s => s.startDate.getTime());
        expect(days).toEqual([...days].sort((a, b) => a - b));
        expect(result.categorySamples).toHaveLength(3);
    });

    it('a failing per-type query does not sink the whole import', async () => {
        const client = makeClient({
            queryCategorySamples: async (identifier: string) => {
                if (identifier === 'HKCategoryTypeIdentifierMenstrualFlow') {
                    throw new Error('native failure');
                }
                if (identifier === 'HKCategoryTypeIdentifierContraceptive') {
                    return [catSample(identifier, new Date(2024, 0, 1))];
                }
                return [];
            },
        });
        const src = new HealthKitSource(client);
        const result = await src.query();
        expect(result.permissionState).toBe('available');
        expect(result.categorySamples).toHaveLength(1);
        expect(result.categorySamples[0].categoryType).toBe('HKCategoryTypeIdentifierContraceptive');
    });

    it('populates truncation when the client exposes an earliest-authorized floor', async () => {
        const client = makeClient({
            queryCategorySamples: async (identifier: string) =>
                identifier === 'HKCategoryTypeIdentifierMenstrualFlow'
                    ? [catSample(identifier, new Date(2026, 0, 5))]
                    : [],
            getEarliestAuthorizedDate: async () => new Date(2026, 0, 1),
        });
        const src = new HealthKitSource(client);
        const result = await src.query({ requestedStart: new Date(2020, 0, 1) });
        expect(result.truncation).toEqual({ earliestAuthorized: '2026-01-01' });
    });

    it('does not report truncation when the floor is not later than the requested start', async () => {
        const client = makeClient({
            queryCategorySamples: async (identifier: string) =>
                identifier === 'HKCategoryTypeIdentifierMenstrualFlow'
                    ? [catSample(identifier, new Date(2026, 0, 5))]
                    : [],
            getEarliestAuthorizedDate: async () => new Date(2019, 0, 1),
        });
        const src = new HealthKitSource(client);
        const result = await src.query({ requestedStart: new Date(2020, 0, 1) });
        expect(result.truncation).toBeNull();
    });
});
