/**
 * HealthKitSource — the permission-state model + one-shot read query for Apple
 * Health cycle history.
 *
 * The library (`@kingstinct/react-native-healthkit`) is wrapped behind a small
 * `HealthKitClient` interface so unit tests can inject a mock and never touch
 * native code. The production client is built by `createLibraryClient()` from a
 * STATIC import of the library — `await import()` fails on physical devices in
 * this repo (documented device trap), so dynamic import is deliberately avoided.
 *
 * READ-ONLY posture (load-bearing, D3.3): authorization is requested with
 * `{ toRead }` only — never `toShare`. No write/update type is ever named here.
 *
 * Permission opacity (Apple, verbatim): a denied read is INDISTINGUISHABLE from
 * "no data" — both return zero samples. Zero samples therefore NEVER throws and
 * is NEVER an error; it surfaces as permissionState 'ambiguous-zero'.
 *
 * REAL-API DEVIATION (noted for the record): the plan's §2 premise that "the
 * earliest authorized date per type is discoverable" does not hold — neither
 * HealthKit nor this library exposes the granted read window. The truncation
 * plumbing is therefore driven by an OPTIONAL `getEarliestAuthorizedDate` hook
 * on the client which the production wrapper leaves unimplemented (returns
 * null → no truncation). Tests inject a client that returns a date to exercise
 * the truncation path. If Apple ever exposes the window, only the wrapper hook
 * changes.
 */
import HealthKit, {
    isHealthDataAvailable,
    getRequestStatusForAuthorization,
    requestAuthorization,
    queryCategorySamples,
    queryQuantitySamples,
} from '@kingstinct/react-native-healthkit';
import { toLocalIsoDate } from './ImportService';

// --- Type identifiers we read (reproductive-health category types + BBT) -----

/**
 * The reproductive-health `HKCategoryTypeIdentifier` values we query. Confirmed
 * against the installed d.ts (generated/healthkit.generated.d.ts). Beta-only
 * types (`menopausalState`, `bleedingAfterMenopause`) are intentionally omitted
 * — they are not part of the shipping reproductive-health set and are preserved
 * as notes only if a sample of an unlisted type is ever handed to the mapper.
 */
export const REPRODUCTIVE_CATEGORY_TYPES = [
    'HKCategoryTypeIdentifierMenstrualFlow',
    'HKCategoryTypeIdentifierIntermenstrualBleeding',
    'HKCategoryTypeIdentifierPersistentIntermenstrualBleeding',
    'HKCategoryTypeIdentifierProlongedMenstrualPeriods',
    'HKCategoryTypeIdentifierIrregularMenstrualCycles',
    'HKCategoryTypeIdentifierInfrequentMenstrualCycles',
    'HKCategoryTypeIdentifierCervicalMucusQuality',
    'HKCategoryTypeIdentifierOvulationTestResult',
    'HKCategoryTypeIdentifierProgesteroneTestResult',
    'HKCategoryTypeIdentifierSexualActivity',
    'HKCategoryTypeIdentifierContraceptive',
    'HKCategoryTypeIdentifierPregnancy',
    'HKCategoryTypeIdentifierPregnancyTestResult',
    'HKCategoryTypeIdentifierLactation',
] as const;

export const BBT_QUANTITY_TYPE = 'HKQuantityTypeIdentifierBasalBodyTemperature';

/** Basal body temperature is read in Celsius; the mapper stores the raw value. */
export const BBT_UNIT = 'degC';

// --- Sample shapes handed to the mapper (library-agnostic) -------------------

export interface HealthKitCategorySample {
    categoryType: string;
    value: number;
    startDate: Date;
    endDate: Date;
    metadata?: Record<string, unknown>;
}

export interface HealthKitQuantitySample {
    quantityType: string;
    quantity: number;
    unit: string;
    startDate: Date;
    endDate: Date;
    metadata?: Record<string, unknown>;
}

export interface HealthKitSampleSet {
    categorySamples: HealthKitCategorySample[];  // ts-ascending
    quantitySamples: HealthKitQuantitySample[];  // ts-ascending
}

// --- The lifecycle states, and the post-query result -------------------------

/**
 * Full permission lifecycle. The first three are PRE-query states surfaced by
 * `getPermissionState()`; the last two are POST-query and are what an
 * `ImportPreview` carries (§14 permissionState union is the latter two only).
 */
export type HealthKitPermissionState =
    | 'unavailable'      // isHealthDataAvailable() === false (iPad / no Health app)
    | 'not-determined'   // never asked (shouldRequest)
    | 'requested'        // already asked (grant state is opaque by design)
    | 'available'        // query returned ≥1 sample
    | 'ambiguous-zero';  // query returned 0 — denial vs. truly-empty, unknowable

export type HealthKitPrequeryState = 'unavailable' | 'not-determined' | 'requested';

export interface HealthKitQueryResult extends HealthKitSampleSet {
    /** 'available' when any sample came back; 'ambiguous-zero' when none did. */
    permissionState: 'available' | 'ambiguous-zero';
    /** Present only when the client exposes an authorized-window floor. */
    truncation: { earliestAuthorized: string } | null;
}

export interface HealthKitQueryOptions {
    /**
     * Earliest history we ask for. Truncation is reported when the client's
     * (optional) earliest-authorized floor is LATER than this. Defaults to the
     * Unix epoch — "everything".
     */
    requestedStart?: Date;
}

// --- The injectable client boundary ------------------------------------------

export interface HealthKitCategoryQueryOptions {
    limit: number;
    ascending?: boolean;
}
export interface HealthKitQuantityQueryOptions extends HealthKitCategoryQueryOptions {
    unit?: string;
}

export interface HealthKitClient {
    isHealthDataAvailable(): boolean;
    getRequestStatusForAuthorization(toCheck: { toRead: readonly string[] }): Promise<number>;
    requestAuthorization(toRequest: { toRead: readonly string[] }): Promise<boolean>;
    queryCategorySamples(
        identifier: string,
        options: HealthKitCategoryQueryOptions,
    ): Promise<readonly HealthKitCategorySample[]>;
    queryQuantitySamples(
        identifier: string,
        options: HealthKitQuantityQueryOptions,
    ): Promise<readonly HealthKitQuantitySample[]>;
    /**
     * OPTIONAL earliest-authorized-date floor. Not implemented by the real
     * library (Apple does not expose it); returns null there. Only ever used to
     * populate `truncation`.
     */
    getEarliestAuthorizedDate?(): Promise<Date | null>;
}

// AuthorizationRequestStatus enum values (from types/Auth.d.ts):
//   unknown = 0, shouldRequest = 1, unnecessary = 2
const AUTH_STATUS_SHOULD_REQUEST = 1;
const AUTH_STATUS_UNNECESSARY = 2;

/**
 * Build the production client from the statically-imported library. Kept lazy
 * (only called by the default HealthKitSource constructor) so tests that inject
 * a mock client never reach the native functions.
 */
export function createLibraryClient(): HealthKitClient {
    const toObj = (m: unknown): Record<string, unknown> | undefined =>
        m && typeof m === 'object' ? (m as Record<string, unknown>) : undefined;

    return {
        isHealthDataAvailable: () => isHealthDataAvailable(),
        getRequestStatusForAuthorization: (toCheck) =>
            getRequestStatusForAuthorization(toCheck as any) as unknown as Promise<number>,
        requestAuthorization: (toRequest) => requestAuthorization(toRequest as any),
        queryCategorySamples: async (identifier, options) => {
            const raw = await queryCategorySamples(identifier as any, options as any);
            return raw.map((s: any) => ({
                categoryType: s.categoryType,
                value: s.value,
                startDate: s.startDate,
                endDate: s.endDate,
                metadata: toObj(s.metadata),
            }));
        },
        queryQuantitySamples: async (identifier, options) => {
            const raw = await queryQuantitySamples(identifier as any, options as any);
            return raw.map((s: any) => ({
                quantityType: s.quantityType,
                quantity: s.quantity,
                unit: s.unit,
                startDate: s.startDate,
                endDate: s.endDate,
                metadata: toObj(s.metadata),
            }));
        },
        // getEarliestAuthorizedDate intentionally omitted — the API does not exist.
    };
}

/** Suppress "unused" on the default export while keeping the static import. */
void HealthKit;

// --- The source ---------------------------------------------------------------

export class HealthKitSource {
    private readonly client: HealthKitClient;

    constructor(client?: HealthKitClient) {
        this.client = client ?? createLibraryClient();
    }

    /** iPad / device with no Health store → false. Cheap, synchronous. */
    isAvailable(): boolean {
        return this.client.isHealthDataAvailable();
    }

    /** The read-only authorization request payload (never names a write type). */
    private authTypes(): { toRead: readonly string[] } {
        return { toRead: [...REPRODUCTIVE_CATEGORY_TYPES, BBT_QUANTITY_TYPE] };
    }

    /**
     * PRE-query permission state. Never throws for a denial (that is opaque);
     * only reports whether the OS sheet still needs to be shown.
     */
    async getPermissionState(): Promise<HealthKitPrequeryState> {
        if (!this.isAvailable()) return 'unavailable';
        const status = await this.client.getRequestStatusForAuthorization(this.authTypes());
        // shouldRequest → we have never asked. unnecessary/unknown → already
        // asked (or nothing more to ask); grant vs. denial stays opaque.
        return status === AUTH_STATUS_SHOULD_REQUEST ? 'not-determined' : 'requested';
    }

    /** Present the OS permission sheet (read-only types). Grant state is opaque. */
    async requestPermission(): Promise<void> {
        await this.client.requestAuthorization(this.authTypes());
    }

    /**
     * One-shot read across every reproductive-health category type + BBT.
     * Returns ts-ascending samples plus the post-query permission state.
     *
     * Zero samples NEVER throws: it is reported as 'ambiguous-zero'. A native
     * error from an individual type query is logged (code/shape only, never
     * values) and that type contributes nothing — a single unavailable type must
     * not sink the whole import.
     */
    async query(options: HealthKitQueryOptions = {}): Promise<HealthKitQueryResult> {
        const categorySamples: HealthKitCategorySample[] = [];
        for (const identifier of REPRODUCTIVE_CATEGORY_TYPES) {
            try {
                const samples = await this.client.queryCategorySamples(identifier, {
                    limit: 0,          // 0 → all samples (library contract)
                    ascending: true,
                });
                for (const s of samples) categorySamples.push(s);
            } catch (e) {
                console.warn(`[HealthKitSource] category query failed for ${identifier}`, describeError(e));
            }
        }

        const quantitySamples: HealthKitQuantitySample[] = [];
        try {
            const samples = await this.client.queryQuantitySamples(BBT_QUANTITY_TYPE, {
                limit: 0,
                ascending: true,
                unit: BBT_UNIT,
            });
            for (const s of samples) quantitySamples.push(s);
        } catch (e) {
            console.warn(`[HealthKitSource] quantity query failed for ${BBT_QUANTITY_TYPE}`, describeError(e));
        }

        // Sort ts-ascending (defensive — do not trust per-type ordering).
        categorySamples.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        quantitySamples.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        const total = categorySamples.length + quantitySamples.length;
        const permissionState: 'available' | 'ambiguous-zero' =
            total === 0 ? 'ambiguous-zero' : 'available';

        const truncation = await this.computeTruncation(options.requestedStart);

        console.log(
            `[HealthKitSource] query complete: ${categorySamples.length} category + ` +
            `${quantitySamples.length} quantity sample(s), state=${permissionState}` +
            (truncation ? `, truncatedAt=${truncation.earliestAuthorized}` : ''),
        );

        return { categorySamples, quantitySamples, permissionState, truncation };
    }

    private async computeTruncation(
        requestedStart?: Date,
    ): Promise<{ earliestAuthorized: string } | null> {
        if (typeof this.client.getEarliestAuthorizedDate !== 'function') return null;
        const earliest = await this.client.getEarliestAuthorizedDate();
        if (!earliest) return null;
        // Only a floor LATER than what we asked for clips history. With no
        // requestedStart we asked for "everything", so any floor clips.
        if (requestedStart && earliest.getTime() <= requestedStart.getTime()) return null;
        return { earliestAuthorized: toLocalIsoDate(earliest.getTime()) };
    }
}

/** Loggable error shape — code/name only, never health values (§8.3-4). */
function describeError(e: unknown): string {
    if (e && typeof e === 'object') {
        const anyE = e as { code?: unknown; name?: unknown; message?: unknown };
        return String(anyE.code ?? anyE.name ?? anyE.message ?? 'unknown');
    }
    return String(e);
}
