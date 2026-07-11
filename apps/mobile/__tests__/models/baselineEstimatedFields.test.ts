import { describe, it, expect } from 'vitest';
import {
    normalizeBaseline,
    hasRealAnchor,
    toggleEstimatedField,
    createDefaultBaselineCycleData,
    PERIOD_DEFAULT,
    CYCLE_DEFAULT,
    type BaselineCycleData,
} from '../../src/models/BaselineCycleData';

// ── normalizeBaseline (read-side default for old payloads) ──────────
//
// T7/§4: `estimatedFields` is an ADDITIVE schema rev. Old encrypted
// `locket_baseline_v2` payloads (and legacy plaintext) predate it, so they
// parse to `estimatedFields === undefined`. normalizeBaseline must default to []
// so `.includes(...)` in consumers never throws.

describe('normalizeBaseline', () => {
    it('defaults a missing estimatedFields to [] (pre-T7 payload)', () => {
        const oldPayload = {
            lastPeriodDate: '2026-01-15',
            periodLength: 5,
            cycleLength: 28,
            hasSeededInitialData: true,
        } as BaselineCycleData;
        const normalized = normalizeBaseline(oldPayload);
        expect(normalized.estimatedFields).toEqual([]);
        // other fields preserved
        expect(normalized.lastPeriodDate).toBe('2026-01-15');
        expect(normalized.periodLength).toBe(5);
        expect(normalized.cycleLength).toBe(28);
        expect(normalized.hasSeededInitialData).toBe(true);
    });

    it('preserves an existing estimatedFields array', () => {
        const payload = {
            periodLength: PERIOD_DEFAULT,
            cycleLength: CYCLE_DEFAULT,
            estimatedFields: ['lastPeriodDate', 'cycleLength'],
        } as BaselineCycleData;
        const normalized = normalizeBaseline(payload);
        expect(normalized.estimatedFields).toEqual(['lastPeriodDate', 'cycleLength']);
    });

    it('coerces a non-array estimatedFields (corrupt/legacy) to []', () => {
        const payload = {
            periodLength: 5,
            cycleLength: 28,
            estimatedFields: null,
        } as unknown as BaselineCycleData;
        expect(normalizeBaseline(payload).estimatedFields).toEqual([]);
    });

    it('is idempotent', () => {
        const once = normalizeBaseline({ periodLength: 5, cycleLength: 28 } as BaselineCycleData);
        const twice = normalizeBaseline(once);
        expect(twice.estimatedFields).toEqual([]);
    });

    it('an old payload round-trips (parse → normalize) without crashing consumers', () => {
        // Simulates unwrapBaseline(JSON.parse(...)) on a pre-T7 encrypted payload.
        const wireJson = '{"lastPeriodDate":"2025-12-01","periodLength":6,"cycleLength":30}';
        const parsed = JSON.parse(wireJson) as BaselineCycleData;
        const normalized = normalizeBaseline(parsed);
        // The critical guarantee: .includes() is now safe.
        expect(() => normalized.estimatedFields.includes('lastPeriodDate')).not.toThrow();
        expect(normalized.estimatedFields.includes('lastPeriodDate')).toBe(false);
    });
});

// ── hasRealAnchor (seed-guard predicate) ────────────────────────────
//
// The LedgerScreen initial-seed effect gates on this. The "skip-all" path must
// NOT seed (and must not crash on `lastPeriodDate.split('-')`).

describe('hasRealAnchor', () => {
    it('is true for a real, non-estimated last-period date', () => {
        expect(
            hasRealAnchor({ lastPeriodDate: '2026-01-15', estimatedFields: [] }),
        ).toBe(true);
    });

    it('is false when lastPeriodDate is undefined (I\'m not sure path)', () => {
        expect(
            hasRealAnchor({ lastPeriodDate: undefined, estimatedFields: ['lastPeriodDate'] }),
        ).toBe(false);
    });

    it('is false when lastPeriodDate is flagged estimated even if a value lingers', () => {
        expect(
            hasRealAnchor({ lastPeriodDate: '2026-01-15', estimatedFields: ['lastPeriodDate'] }),
        ).toBe(false);
    });

    it('is true when only OTHER fields are estimated', () => {
        expect(
            hasRealAnchor({ lastPeriodDate: '2026-01-15', estimatedFields: ['periodLength', 'cycleLength'] }),
        ).toBe(true);
    });

    it('is false for null / undefined config', () => {
        expect(hasRealAnchor(null)).toBe(false);
        expect(hasRealAnchor(undefined)).toBe(false);
    });

    it('tolerates a missing estimatedFields (old payload shape) — real date anchors', () => {
        expect(hasRealAnchor({ lastPeriodDate: '2026-01-15' } as any)).toBe(true);
    });

    it('skip-all onboarding path (all three unsure) does not anchor', () => {
        // A user who tapped "I'm not sure" on every step: no date, defaults used.
        const config: BaselineCycleData = {
            periodLength: PERIOD_DEFAULT,
            cycleLength: CYCLE_DEFAULT,
            estimatedFields: ['lastPeriodDate', 'periodLength', 'cycleLength'],
            hasSeededInitialData: false,
        };
        expect(hasRealAnchor(config)).toBe(false);
    });
});

// ── toggleEstimatedField (QA item 7b: "I'm not sure" is toggleable) ──
//
// Selecting unsure flags the field and applies the clinical default; a second
// tap deselects it. Mutually exclusive with a manual value. Pure — never mutates.

describe('toggleEstimatedField', () => {
    it('SELECT: flags periodLength estimated and applies the default', () => {
        const config: BaselineCycleData = {
            periodLength: 8,
            cycleLength: 28,
            estimatedFields: [],
        };
        const next = toggleEstimatedField(config, 'periodLength');
        expect(next.estimatedFields).toContain('periodLength');
        expect(next.periodLength).toBe(PERIOD_DEFAULT);
    });

    it('SELECT: flags cycleLength estimated and applies the default', () => {
        const config: BaselineCycleData = {
            periodLength: 5,
            cycleLength: 42,
            estimatedFields: [],
        };
        const next = toggleEstimatedField(config, 'cycleLength');
        expect(next.estimatedFields).toContain('cycleLength');
        expect(next.cycleLength).toBe(CYCLE_DEFAULT);
    });

    it('SELECT: flags lastPeriodDate estimated and clears the date (no anchor)', () => {
        const config: BaselineCycleData = {
            lastPeriodDate: '2026-02-01',
            periodLength: 5,
            cycleLength: 28,
            estimatedFields: [],
        };
        const next = toggleEstimatedField(config, 'lastPeriodDate');
        expect(next.estimatedFields).toContain('lastPeriodDate');
        expect(next.lastPeriodDate).toBeUndefined();
        expect(hasRealAnchor(next)).toBe(false);
    });

    it('DESELECT: a second toggle removes the estimated flag', () => {
        const config: BaselineCycleData = {
            periodLength: 5,
            cycleLength: 28,
            estimatedFields: ['periodLength'],
        };
        const next = toggleEstimatedField(config, 'periodLength');
        expect(next.estimatedFields).not.toContain('periodLength');
    });

    it('DESELECT: leaves other estimated fields intact', () => {
        const config: BaselineCycleData = {
            periodLength: 5,
            cycleLength: 28,
            estimatedFields: ['periodLength', 'cycleLength'],
        };
        const next = toggleEstimatedField(config, 'periodLength');
        expect(next.estimatedFields).toEqual(['cycleLength']);
    });

    it('is a round-trip: select then deselect returns to an empty flag set', () => {
        const config: BaselineCycleData = {
            periodLength: 9,
            cycleLength: 28,
            estimatedFields: [],
        };
        const selected = toggleEstimatedField(config, 'periodLength');
        const deselected = toggleEstimatedField(selected, 'periodLength');
        expect(deselected.estimatedFields).toEqual([]);
    });

    it('tolerates a missing estimatedFields (old payload shape) on select', () => {
        const config = { periodLength: 5, cycleLength: 28 } as BaselineCycleData;
        const next = toggleEstimatedField(config, 'cycleLength');
        expect(next.estimatedFields).toEqual(['cycleLength']);
    });

    it('does not mutate the input config', () => {
        const config: BaselineCycleData = {
            periodLength: 5,
            cycleLength: 28,
            estimatedFields: [],
        };
        toggleEstimatedField(config, 'periodLength');
        expect(config.estimatedFields).toEqual([]);
        expect(config.periodLength).toBe(5);
    });
});

// ── createDefaultBaselineCycleData now carries estimatedFields ───────

describe('createDefaultBaselineCycleData (T7)', () => {
    it('includes an empty estimatedFields array', () => {
        expect(createDefaultBaselineCycleData().estimatedFields).toEqual([]);
    });
});
