import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Coverage for the HealthKitSource branches added by the pre-landing review
 * fixes, which the original HealthKitSource.test.ts predates:
 *
 *  - query() throws when EVERY per-type query fails (hard read fault, not
 *    'ambiguous-zero' — otherwise the user is sent to a permissions screen to
 *    fix a missing entitlement);
 *  - getPermissionState() maps the `unknown` (0) status to 'not-determined',
 *    so a failed status probe still shows the OS sheet;
 *  - requestedStart bounds the READ (forwarded as `startDate` on every query),
 *    not merely the truncation report;
 *  - createLibraryClient() rewrites our flat `startDate` into the library's
 *    `filter.date.startDate` — the only shape it honours. Passing it flat is
 *    silently ignored and returns the entire archive.
 */

// Declared with an args signature so `mock.calls[n][1]` is typed — a zero-arg
// vi.fn() gives calls an empty-tuple type and indexing it fails tsc (vitest
// itself does not typecheck, so that only surfaces in `turbo run build`).
const queryCategorySamples = vi.fn(async (..._args: any[]) => [] as any[]);
const queryQuantitySamples = vi.fn(async (..._args: any[]) => [] as any[]);

vi.mock('@kingstinct/react-native-healthkit', () => ({
    default: {},
    isHealthDataAvailable: vi.fn(() => true),
    getRequestStatusForAuthorization: vi.fn(async () => 2),
    requestAuthorization: vi.fn(async () => true),
    queryCategorySamples: (...args: any[]) => (queryCategorySamples as any)(...args),
    queryQuantitySamples: (...args: any[]) => (queryQuantitySamples as any)(...args),
}));

import {
    HealthKitSource,
    createLibraryClient,
    REPRODUCTIVE_CATEGORY_TYPES,
    BBT_QUANTITY_TYPE,
    type HealthKitClient,
} from '../../src/services/HealthKitSource';

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

describe('HealthKitSource.query — total read failure is loud', () => {
    it('throws when EVERY query fails, instead of reporting ambiguous-zero', async () => {
        const src = new HealthKitSource(makeClient({
            queryCategorySamples: async () => { throw new Error('no native module'); },
            queryQuantitySamples: async () => { throw new Error('no native module'); },
        }));
        await expect(src.query()).rejects.toThrow(/All \d+ Apple Health queries failed/);
    });

    it('does NOT throw when at least one query succeeds, even with zero samples', async () => {
        // Every category type fails; the BBT quantity query succeeds but is empty.
        const src = new HealthKitSource(makeClient({
            queryCategorySamples: async () => { throw new Error('boom'); },
        }));
        const result = await src.query();
        expect(result.permissionState).toBe('ambiguous-zero');
        expect(result.categorySamples).toEqual([]);
    });
});

describe('HealthKitSource.getPermissionState — unknown status', () => {
    it('treats the unknown (0) status as not-determined so the OS sheet still shows', async () => {
        const src = new HealthKitSource(makeClient({ getRequestStatusForAuthorization: async () => 0 }));
        expect(await src.getPermissionState()).toBe('not-determined');
    });
});

describe('HealthKitSource.query — requestedStart bounds the read', () => {
    it('forwards requestedStart as startDate on every category query AND the BBT query', async () => {
        const catOpts: any[] = [];
        const qtyOpts: any[] = [];
        const src = new HealthKitSource(makeClient({
            queryCategorySamples: async (_id, opts) => { catOpts.push(opts); return []; },
            queryQuantitySamples: async (_id, opts) => { qtyOpts.push(opts); return []; },
        }));
        const start = new Date(2024, 0, 1);
        await src.query({ requestedStart: start });

        expect(catOpts).toHaveLength(REPRODUCTIVE_CATEGORY_TYPES.length);
        expect(catOpts.every((o) => o.startDate === start)).toBe(true);
        expect(catOpts.every((o) => o.limit === 0 && o.ascending === true)).toBe(true);
        expect(qtyOpts).toHaveLength(1);
        expect(qtyOpts[0].startDate).toBe(start);
        expect(qtyOpts[0].unit).toBeDefined();
    });

    it('omits startDate entirely when no requestedStart is given', async () => {
        const catOpts: any[] = [];
        const src = new HealthKitSource(makeClient({
            queryCategorySamples: async (_id, opts) => { catOpts.push(opts); return []; },
        }));
        await src.query();
        expect(catOpts.every((o) => !('startDate' in o))).toBe(true);
    });
});

describe('createLibraryClient — library option shape', () => {
    beforeEach(() => {
        queryCategorySamples.mockClear();
        queryQuantitySamples.mockClear();
        queryCategorySamples.mockResolvedValue([]);
        queryQuantitySamples.mockResolvedValue([]);
    });

    it('rewrites startDate into filter.date.startDate (flat startDate is ignored by the library)', async () => {
        const client = createLibraryClient();
        const start = new Date(2024, 5, 1);
        await client.queryCategorySamples('HKCategoryTypeIdentifierMenstrualFlow', {
            limit: 0, ascending: true, startDate: start,
        });

        const opts = queryCategorySamples.mock.calls[0][1] as any;
        expect(opts.startDate).toBeUndefined();
        expect(opts.filter).toEqual({ date: { startDate: start } });
        expect(opts.limit).toBe(0);
        expect(opts.ascending).toBe(true);
    });

    it('passes no filter at all when startDate is absent', async () => {
        const client = createLibraryClient();
        await client.queryQuantitySamples(BBT_QUANTITY_TYPE, { limit: 0, ascending: true, unit: 'degC' });
        const opts = queryQuantitySamples.mock.calls[0][1] as any;
        expect('filter' in opts).toBe(false);
        expect(opts.unit).toBe('degC');
    });

    it('normalizes library samples into the mapper-facing shape (metadata objects only)', async () => {
        queryCategorySamples.mockResolvedValue([
            { categoryType: 'HKCategoryTypeIdentifierMenstrualFlow', value: 3, startDate: new Date(2024, 0, 1), endDate: new Date(2024, 0, 1), metadata: 'not-an-object' },
        ] as any);
        const client = createLibraryClient();
        const out = await client.queryCategorySamples('HKCategoryTypeIdentifierMenstrualFlow', { limit: 0 });
        expect(out[0].metadata).toBeUndefined();
        expect(out[0].value).toBe(3);
    });

    it('does not implement getEarliestAuthorizedDate (Apple exposes no such window)', () => {
        expect(createLibraryClient().getEarliestAuthorizedDate).toBeUndefined();
    });
});
