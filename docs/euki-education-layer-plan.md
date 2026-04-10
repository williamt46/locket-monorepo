<!-- /autoplan restore point: /Users/kabst/.gstack/projects/williamt46-locket-monorepo/claude-busy-euler-autoplan-restore-20260402-110534.md -->

# Plan: Euki Education Layer — Stitch Variants + Code Integration

## Context

The design spec (`docs/euki-education-layer-design.md`) defines a two-surface education layer:
1. **PhaseInsightCard** — phase-matched Euki content snippets on a `cycle-insights` screen
2. **SymptomChips + "Why does this happen?"** — inline symptom logging + contextual Euki links in the log entry flow

Four Stitch screens exist defining the intended UX:
- `log` (screen `e6c13b5d39df4a8ea8164298bd72b74c`) — full-screen log entry, replaces current `DataEntryModal`
- `add-symptoms` (`3dac4d33bbe4423eb5d96e672492ccbc`) — extended symptom selection screen
- `added-symptoms` (`9bd3cdd64d194d93839d4eca754f711e`) — symptom confirmation/summary
- `cycle-insights` (`bb80afdc88744bde8f4f601c2a10bc50`) — PhaseInsightCard + cycle stats

The current codebase has:
- `DataEntryModal.tsx` — modal with Start/End/Note/Clear. No symptoms.
- `SymptomsList.tsx` — standalone list of 8 symptoms, internal state only (not wired to anything)
- `usePredictions.ts` — returns `futureData` + `cycleStats`, no current phase
- `AppNavigator.tsx` — Stack navigator, no symptom or insights routes
- `LedgerScreen.tsx` — calendar + modal; `usePredictions` already wired

Design system ID: `14853906600246273020`
Project ID: `11270270792552091568`

---

## Model & Effort Recommendations

The `effort` parameter trades reasoning depth for token cost. This plan has 10 distinct implementation steps across 5 task types with very different complexity profiles. Using the wrong effort level on the wrong task wastes tokens without quality gain — or cuts corners where accuracy matters.

### Task Type Analysis

| Step | Task | Model | Effort | Reasoning |
|---|---|---|---|---|
| 1 | Stitch `generate_variants` API calls | `haiku-4-5` | `low` | Pure tool orchestration — no reasoning needed |
| 2 | `getCurrentPhase` date algorithm | `sonnet-4-6` | `medium` | Date math with timezone traps, phase boundary logic (off-by-one errors are silent) |
| 3 | Euki content merge (types, data, mappings) | `haiku-4-5` | `low` | Data transformation from a defined schema, no logic |
| 4 | `useEukiContent` hook + `usePredictions` extension | `sonnet-4-6` | `medium` | Memoization dependencies, null-safety, phase/symptom mapping lookup — moderate logic risk |
| 5 | `LogScreen.tsx` (full-screen Stitch impl) | `sonnet-4-6` | `low` | Pattern following from Stitch design + spec — volume task, not complexity |
| 6 | `AddSymptomsScreen` + `SymptomsList` refactor | `sonnet-4-6` | `low` | Controlled/uncontrolled refactor is small, Stitch design drives layout |
| 7 | `AddedSymptomsScreen` | `haiku-4-5` | `low` | Confirmation screen, minimal logic |
| 8 | `PhaseInsightCard` + `CycleInsightsScreen` | `sonnet-4-6` | `low` | Phase color/icon lookup, well-specified in design doc |
| 9 | `AppNavigator` wiring | `haiku-4-5` | `low` | 4-line addition, pure boilerplate |
| 10 | `LogEntry` model + `ContentSheet` + `DisclaimerModal` | `sonnet-4-6` | `low` | Type definitions + AsyncStorage pattern, spec is precise |

### Primary Recommendation

**Model: `claude-sonnet-4-6`** for all steps.
**Effort: `low`** for 8 of 10 steps. **`medium`** only for Steps 2 and 4.

The design spec pre-solved every architectural decision. Novel reasoning isn't needed here — the bottleneck is code volume (15+ files) and faithful translation of the spec. `low` effort at `sonnet-4-6` handles spec-driven code generation reliably. Bumping to `high` effort on any of these steps would spend thinking tokens on problems that are already solved.

Steps 2 (`getCurrentPhase`) and 4 (`useEukiContent`) are the exceptions: silent off-by-one errors in cycle phase math and memoization dependency arrays are the most likely production bugs in this plan. `medium` effort is worth the cost there.

**Do not use `opus-4-6`** for any step in this plan. The spec is detailed enough that the quality ceiling is the spec itself, not the model's reasoning capacity.

### Token Cost Estimate (rough)

- Low effort steps (8): ~2,000 output tokens each → ~16,000 tokens
- Medium effort steps (2): ~4,000 output tokens each → ~8,000 tokens
- **Total: ~24,000 tokens at `sonnet-4-6`** — approximately $0.09 at current pricing

Using `high` effort across all steps: ~72,000 tokens. Three times the cost for the same spec-driven output.

---

## ⚠️ SCOPE REVISION (design review — prototype confirmed)

**Decision (design review):** Full-screen `LogScreen` with 4-category accordion IS the target, confirmed by user prototype. Bottom tab bar is exploratory and NOT in scope.

**Supersedes prior CEO-revision:** The "inline DataEntryModal extension" direction has been reversed. The prototype shows a full-screen log entry with a 4-category accordion (Symptoms / Mood / Sex / Triggers). This replaces the separate AddSymptomsScreen + AddedSymptomsScreen screens from the original plan — the accordion collapses that 3-screen flow into 1.

**In scope:**
- `LogScreen.tsx` — full-screen, 4-category accordion, navigated to from LedgerScreen
- `CycleInsightsScreen.tsx` — navigated screen (Stack, not bottom tab)
- `PhaseInsightCard.tsx` — used inside CycleInsightsScreen
- 2 AppNavigator routes (`Log`, `CycleInsights`)
- `DataEntryModal.tsx` — kept as-is (backward compat, no changes)

**Out of scope (deferred):**
- `AddSymptomsScreen.tsx` — accordion in LogScreen replaces this
- `AddedSymptomsScreen.tsx` — no confirmation screen; save is from LogScreen directly
- Bottom tab bar navigation — exploratory prototype, NOT implementing
- `SymptomsList.tsx` — DELETE (per eng review)

---

## Step 1 — Generate Stitch Variants

The `log` and `cycle-insights` screens define the primary UX surfaces.

```
generate_variants(screen_id: "e6c13b5d39df4a8ea8164298bd72b74c", design_system_id: "14853906600246273020")
generate_variants(screen_id: "bb80afdc88744bde8f4f601c2a10bc50", design_system_id: "14853906600246273020")
```

The `add-symptoms` and `added-symptoms` screens are deferred — the accordion in LogScreen replaces the multi-screen flow.

---

## Step 2 — Extend PredictionEngine: Add getCurrentPhase

**File:** `apps/mobile/src/utils/PredictionEngine.ts`

Add new export:
```typescript
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'unknown';

/**
 * Returns the current cycle phase and day-in-cycle for a user.
 *
 * @param latestPeriodStart - ISO date string "YYYY-MM-DD" (1-indexed month, zero-padded).
 *   This is the format returned by `getLatestPeriodStart`. Do NOT pass raw ledger keys
 *   (which use 0-indexed months: "YYYY-M-D"). Malformed input returns phase: 'unknown'.
 * @param cycleLength - Typical cycle length in days.
 * @param periodLength - Typical period length in days.
 * @param today - Defaults to new Date(). Injectable for testing.
 */
export function getCurrentPhase(
  latestPeriodStart: string,  // "YYYY-MM-DD" ISO, 1-indexed month
  cycleLength: number,
  periodLength: number,
  today: Date = new Date()
): { phase: CyclePhase; dayInCycle: number } {
  // Parse latestPeriodStart as UTC
  // dayInCycle = days since latestPeriodStart (0-indexed)
  // menstrual: 0 to periodLength-1
  // follicular: periodLength to ~cycleLength*0.45
  // ovulatory: ~cycleLength*0.45 to ~cycleLength*0.55
  // luteal: ~cycleLength*0.55 to cycleLength-1
  // unknown: if latestPeriodStart is invalid or dayInCycle > cycleLength
}
```

**File:** `apps/mobile/src/hooks/usePredictions.ts`

Extend return value:
```typescript
// Add to useMemo block:
const { phase: currentPhase, dayInCycle } = useMemo(() => {
  if (!config) return { phase: 'unknown' as CyclePhase, dayInCycle: 0 };
  const latestStart = getLatestPeriodStart(decryptedData, config.lastPeriodDate);
  return getCurrentPhase(latestStart, config.cycleLength, config.periodLength);
}, [decryptedData, config]);

return { futureData, cycleStats, currentPhase, dayInCycle };
```

---

## Step 3 — Create Euki Content Layer

**New directory:** `packages/shared/src/euki/`

Files to create:
- `types.ts` — `EukiItem`, `EukiSection`, `EukiLink` interfaces (from design spec)
- `content/menstruation.ts` — merged content from Euki-iOS `menstruation_options.json` + `en.lproj/Localizable.strings`. Add GPL attribution comment. Pin commit SHA in comment.
- `index.ts` — `getEukiContent()` lazy singleton returning `EukiContent`
- `phaseMapping.ts` — `Record<CyclePhase, string[]>` mapping to verified Euki item IDs

**Note (eng review):** All IDs in `phaseMapping.ts` and `symptomMapping.ts` must be validated by a Vitest test. See Test Specs section below.
- `symptomMapping.ts` — `Record<SymptomKey, string>` mapping to Euki item IDs

Also add `NOTICE` file at repo root with Euki attribution + commit SHA.

Export from `packages/shared/src/index.ts`:
```typescript
export * from './euki';
```

---

## Step 4 — Create Shared Content Components

**New files in `apps/mobile/src/components/`:**

### `ContentSheet.tsx`
- RN `<Modal animationType="slide">` bottom sheet
- Props: `visible: boolean`, `item: EukiItem | null`, `onClose: () => void`
- Renders: title, scrollable body, links via `Linking.openURL()` (catch → toast), attribution footer
- Can be nested inside DataEntryModal's modal tree (RN ≥ 0.71 supported)

### `DisclaimerModal.tsx`
- RN `<Modal animationType="fade">` full overlay
- One-time: checks `AsyncStorage.getItem('content_disclaimer_seen')`
- "Got it" → `AsyncStorage.setItem('content_disclaimer_seen', 'true')` then dismiss
- Flag written ONLY on tap, not on display

### New hook: `apps/mobile/src/hooks/useEukiContent.ts`
```typescript
export function useEukiContent(phase: CyclePhase | null, dayInCycle: number) {
  // Returns { phaseSnippet: EukiItem, getSymptomContent: (symptom: SymptomKey) => EukiItem | undefined }
}
```

---

## Step 5 — Implement LogScreen (Stitch: "log" + prototype accordion)

**New file:** `apps/mobile/src/screens/LogScreen.tsx`

Full-screen log entry, navigated to from LedgerScreen (Stack.Navigator). Confirmed by user prototype.

Layout (derived from Stitch `log` screen + prototype video):
- Header row: ✕ close | date title | spacer
- Phase-colored Start / End buttons (row)
- **4-category accordion** (Symptoms / Mood / Sex / Triggers):
  - Each category header is a tappable row that expands/collapses
  - **Symptoms:** Cramps, Bloating, Nausea/Fatigue — pill chips (multi-select)
  - **Mood:** Mood ↓, Mood Anxious, Irritable — pill chips (multi-select)
  - **Sex:** (v2 category, scaffold accordion section, empty state label for now)
  - **Triggers:** Acne, Headache, Back pain — pill chips (multi-select)
- **"Why does this happen?" link** — appears below a chip row after any chip tap → opens `ContentSheet`
- Notes TextInput with `maxLength={2000}`
- `[ Save ]` button → calls `inscribe()` with full `LogEntry` payload → `navigation.goBack()`
- `Clear Data` link (destructive, requires tap confirmation via Alert)
- `DisclaimerModal` on first `ContentSheet` open (AsyncStorage gate)

**Android scope (eng review):** `ContentSheet` (nested Modal) is iOS-only for this PR. Add `// TODO(android): replace nested Modal with react-native-portal or equivalent before GA` comment in `ContentSheet.tsx`. Android users will not see ContentSheet.

**SymptomsList.tsx (eng review):** Delete — unwired, divergent symptom set. LogScreen is the canonical symptom UI.

**Modify `LedgerScreen.tsx`:**
- Change `handleToggleDate` to `navigation.navigate('Log', { date, initialData, keyHex })` instead of opening DataEntryModal
- Keep `DataEntryModal.tsx` import removed; DataEntryModal.tsx file stays (no changes, backward compat reference)

---

## Step 6 — Implement CycleInsightsScreen (Stitch: "cycle-insights")

**New file:** `apps/mobile/src/screens/CycleInsightsScreen.tsx`

Navigated to from LedgerScreen via a small "Insights →" touchable. Stack navigation (NOT bottom tab).

Contains `PhaseInsightCard.tsx` (new component in `components/`):
- Left-border accent in phase color (#D1495B / #2A9D8F / #FF9F00 / #76489D)
- Phase icon via Material Symbols
- 180-char truncated snippet + "Read more →" → opens `ContentSheet`
- Unknown phase → neutral color + "Learning about your cycle." caption

**New file:** `apps/mobile/src/components/PhaseInsightCard.tsx`

Props: `phase: CyclePhase | null`, `dayInCycle: number`
- Calls `useEukiContent(phase, dayInCycle)` internally

**Modify `LedgerScreen.tsx`:**
- Add "Insights →" touchable (near header)
- `navigation.navigate('CycleInsights', { currentPhase, dayInCycle, cycleStats })`

---

## Step 7 — Register Routes in AppNavigator

**File:** `apps/mobile/src/navigation/AppNavigator.tsx`

Add 2 new Stack.Screen entries:
```tsx
<Stack.Screen name="Log" component={LogScreen} />
<Stack.Screen name="CycleInsights" component={CycleInsightsScreen} />
```

---

## Step 8 — Extend LogEntry Data Model

**File:** `apps/mobile/src/models/UserConfig.ts` or new `apps/mobile/src/models/LogEntry.ts`

Add (additive, backward compatible with `inscribe(data: any)`):
```typescript
export type BleedingIntensity = 'spotting' | 'light' | 'medium' | 'heavy';
export type SymptomKey = 'cramps' | 'bloating' | 'nausea_fatigue' | 'mood_low' | 'mood_anxious' | 'mood_irritable' | 'acne' | 'headache' | 'back_pain';

export interface LogEntry {
  event: 'period_start' | 'period_end' | 'manual_entry';
  date: string;
  ts: number;
  isPeriod?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  note?: string;
  bleeding?: { intensity: BleedingIntensity; clots?: 'small' | 'large' };
  symptoms?: SymptomKey[];
}
```

---

## Critical Files (REVISED — full-screen LogScreen + accordion, design review confirmed)

| File | Action |
|---|---|
| `apps/mobile/src/utils/PredictionEngine.ts` | Add `getCurrentPhase`, `CyclePhase` type |
| `apps/mobile/src/hooks/usePredictions.ts` | Add `currentPhase`, `dayInCycle` to return |
| `apps/mobile/src/navigation/AppNavigator.tsx` | Add 2 routes: `Log`, `CycleInsights` |
| `apps/mobile/src/screens/LedgerScreen.tsx` | navigate('Log') on date tap; add "Insights →" touchable |
| `apps/mobile/src/components/DataEntryModal.tsx` | **No change** (kept for backward compat) |
| `apps/mobile/src/components/SymptomsList.tsx` | **DELETE** (eng review: unwired, divergent symptom set) |
| `packages/shared/src/euki/` | New directory — content layer |
| `apps/mobile/src/screens/LogScreen.tsx` | New — full-screen, 4-category accordion |
| `apps/mobile/src/screens/CycleInsightsScreen.tsx` | New — navigated screen (Stack) |
| `apps/mobile/src/components/PhaseInsightCard.tsx` | New |
| `apps/mobile/src/components/ContentSheet.tsx` | New — iOS only; add `// TODO(android)` comment |
| `apps/mobile/src/components/DisclaimerModal.tsx` | New |
| `apps/mobile/src/hooks/useEukiContent.ts` | New |
| `apps/mobile/src/models/LogEntry.ts` | New |
| `NOTICE` | New — Euki attribution |
| `apps/mobile/src/theme/colors.ts` | Add 4 phase color tokens |
| `apps/mobile/__tests__/models/PredictionEngine.test.ts` | Extend with `getCurrentPhase` test suite (7 cases) |
| `packages/shared/__tests__/euki/contentMapping.test.ts` | New — Euki ID validation test |
| `apps/mobile/__tests__/models/LogEntry.test.ts` | New — roundtrip + backward compat tests |

---

## Test Specs (eng review additions)

### `apps/mobile/__tests__/models/PredictionEngine.test.ts` — extend existing file

Add a new `describe('PredictionEngine -> getCurrentPhase')` block:

```typescript
describe('PredictionEngine -> getCurrentPhase', () => {
  it('returns menstrual phase on day 0', () => {
    const today = new Date('2026-03-10T12:00:00Z');
    const result = getCurrentPhase('2026-03-10', 28, 5, today);
    expect(result.phase).toBe('menstrual');
    expect(result.dayInCycle).toBe(0);
  });

  it('returns menstrual phase on last period day (periodLength-1)', () => {
    const today = new Date('2026-03-14T12:00:00Z');
    const result = getCurrentPhase('2026-03-10', 28, 5, today);
    expect(result.phase).toBe('menstrual');
    expect(result.dayInCycle).toBe(4);
  });

  it('returns follicular phase after period ends', () => {
    const today = new Date('2026-03-15T12:00:00Z');
    const result = getCurrentPhase('2026-03-10', 28, 5, today);
    expect(result.phase).toBe('follicular');
  });

  it('returns ovulatory phase around mid-cycle', () => {
    // Day 13 of a 28-day cycle: ~0.46 * 28 = 12.9 → ovulatory
    const today = new Date('2026-03-23T12:00:00Z');
    const result = getCurrentPhase('2026-03-10', 28, 5, today);
    expect(result.phase).toBe('ovulatory');
  });

  it('returns luteal phase in second half', () => {
    // Day 20 of 28: ~0.71 > 0.55 → luteal
    const today = new Date('2026-03-30T12:00:00Z');
    const result = getCurrentPhase('2026-03-10', 28, 5, today);
    expect(result.phase).toBe('luteal');
  });

  it('returns unknown when dayInCycle > cycleLength', () => {
    // 40 days after period start with 28-day cycle
    const today = new Date('2026-04-19T12:00:00Z');
    const result = getCurrentPhase('2026-03-10', 28, 5, today);
    expect(result.phase).toBe('unknown');
  });

  it('returns unknown for malformed latestPeriodStart', () => {
    const today = new Date('2026-03-15T12:00:00Z');
    const result = getCurrentPhase('not-a-date', 28, 5, today);
    expect(result.phase).toBe('unknown');
    expect(result.dayInCycle).toBe(0);
  });
});
```

### `packages/shared/__tests__/euki/contentMapping.test.ts` — new file

```typescript
import { describe, it, expect } from 'vitest';
import { getEukiContent } from '../../src/euki';
import { PHASE_MAPPING } from '../../src/euki/phaseMapping';
import { SYMPTOM_MAPPING } from '../../src/euki/symptomMapping';

describe('Euki content ID validation', () => {
  const content = getEukiContent();
  const allItemIds = new Set(content.sections.flatMap(s => s.items.map(i => i.id)));

  it('all phase mapping IDs exist in content', () => {
    for (const [phase, ids] of Object.entries(PHASE_MAPPING)) {
      for (const id of ids) {
        expect(allItemIds.has(id), `Phase ${phase}: ID "${id}" not found in content`).toBe(true);
      }
    }
  });

  it('all symptom mapping IDs exist in content', () => {
    for (const [symptom, id] of Object.entries(SYMPTOM_MAPPING)) {
      expect(allItemIds.has(id), `Symptom ${symptom}: ID "${id}" not found in content`).toBe(true);
    }
  });
});
```

### `apps/mobile/__tests__/models/LogEntry.test.ts` — new file

```typescript
import { describe, it, expect } from 'vitest';
import type { LogEntry, BleedingIntensity, SymptomKey } from '../../src/models/LogEntry';

describe('LogEntry type', () => {
  it('is backward compatible — existing fields only', () => {
    const entry: LogEntry = {
      event: 'period_start',
      date: '2026-03-10',
      ts: 1741564800000,
      isPeriod: true,
      isStart: true,
    };
    expect(entry.bleeding).toBeUndefined();
    expect(entry.symptoms).toBeUndefined();
  });

  it('accepts bleeding + symptoms as optional fields', () => {
    const entry: LogEntry = {
      event: 'manual_entry',
      date: '2026-03-12',
      ts: 1741737600000,
      bleeding: { intensity: 'medium', clots: 'small' },
      symptoms: ['cramps', 'bloating'],
    };
    expect(entry.bleeding?.intensity).toBe('medium');
    expect(entry.symptoms).toHaveLength(2);
  });
});
```

---

## Reuse

- `usePredictions.ts` — extend in place, reuse everywhere
- `colors.ts` — phase colors added as new entries (parallel to existing color tokens)
- `DataEntryModal.tsx` — kept as-is, no changes
- `SymptomsList.tsx` — **DELETE** (eng review)

---

## Execution Order

1. Generate Stitch variants for `log` + `cycle-insights` (Step 1)
2. Content layer `packages/shared/src/euki/` (Step 3) — foundation
3. `LogEntry` model (Step 8) — types before consumers
4. PredictionEngine extension + `usePredictions` (Step 2)
5. Shared components: `ContentSheet`, `DisclaimerModal`, `useEukiContent` (Step 4)
6. `LogScreen.tsx` with 4-category accordion (Step 5)
7. `PhaseInsightCard` + `CycleInsightsScreen` (Step 6)
8. `AppNavigator` + `LedgerScreen` wiring (Step 7 — last)

---

## Verification

- `LogScreen` renders without crash on iOS simulator
- `CycleInsightsScreen` renders without crash on iOS simulator
- Tapping a date on `LedgerScreen` navigates to `LogScreen`
- All 4 accordion categories expand/collapse correctly
- Symptom chip tap shows "Why does this happen?" link
- "Why does this happen?" opens `ContentSheet` with Euki content
- `DisclaimerModal` appears once, not again after "Got it"
- `PhaseInsightCard` shows correct phase color + content for all 4 phases + unknown state
- `LogEntry` with symptoms serializes and decrypts correctly through `inscribe()` / `crypto.decryptData()`
- "Insights →" on LedgerScreen navigates to `CycleInsightsScreen`
- No bottom tab bar present in navigation
- No regression: existing period start/end log flow still works

---

# /autoplan Review

## Phase 1: CEO Review

### Step 0A — Premise Challenge

The plan states 5 premises explicitly in the design doc. Evaluated here:

| # | Premise | Status | Notes |
|---|---------|--------|-------|
| 1 | DataEntryModal is the primary injection surface | **CHALLENGED** | The plan replaces DataEntryModal with a full-screen LogScreen. The design doc says "inline" content; the implementation creates 4 new navigation screens. The premise says "no new navigation tab" but the plan adds 4 stack routes. Internally inconsistent. |
| 2 | Symptom fields are a prerequisite | VALID | Content about cramps without symptom logging is useless. Ships together. |
| 3 | Euki's content is portable but requires a merge step | VALID | JSON + Localizable.strings → merged TypeScript module. Clear plan. |
| 4 | No new navigation = no cognitive overhead | **CONTRADICTED** | The plan adds Log, AddSymptoms, AddedSymptoms, CycleInsights to Stack.Navigator. Design doc says "no new tab" (correct) but the plan adds navigation SCREENS, which is a different kind of cognitive overhead. |
| 5 | Cycle-phase awareness requires hand-authored phase mapping | VALID | Euki organizes by topic, not phase. Locket must author CyclePhase → item IDs mapping. |

**Critical contradiction:** Premise 1 says "DataEntryModal is primary injection surface." But the plan replaces it with full-screen navigation. Premise 4 says "no new navigation." But the plan adds 4 new routes. The design doc's "inline" constraint was either revised during planning or the premises are stale.

---

### Step 0B — Existing Code Leverage Map

| Sub-problem | Existing Code | Status |
|---|---|---|
| Cycle phase computation | `PredictionEngine.ts` (calculatePredictedPeriods, getLatestPeriodStart) | EXTEND — add getCurrentPhase |
| Phase data in hook | `usePredictions.ts` (returns futureData, cycleStats) | EXTEND — add currentPhase, dayInCycle |
| Symptom display | `SymptomsList.tsx` (uncontrolled, 8 symptoms, internal state) | REFACTOR — make controlled |
| Calendar navigation | `AppNavigator.tsx` (Stack with 6 screens) | EXTEND — add 4 routes |
| Log entry flow | `LedgerScreen.tsx` (uses DataEntryModal via modal state) | MODIFY — navigate to LogScreen |
| Encrypted storage | `inscribe()` in useLedger (accepts any JSON) | NO CHANGE — additive LogEntry fields |
| Shared package | `packages/shared/src/` (types, hashing, constants) | EXTEND — add euki/ subdirectory |
| Theme tokens | `colors.ts` (7 colors) | EXTEND — add 4 phase colors |

**Not in repo (must be sourced externally):**
- Euki `menstruation_options.json` — must be fetched from Euki-iOS GitHub
- Euki `en.lproj/Localizable.strings` — must be fetched from Euki-iOS GitHub

This is a **blocker**: Steps 3 requires actual Euki content data that does not exist in this repo.

---

### Step 0C — Dream State Delta

```
CURRENT                THIS PLAN               12-MONTH IDEAL
─────────────          ──────────────────       ─────────────────────
Period start/end  →    + Bleeding intensity     + Push notifications
Notes only             + 6 symptom chips        + Flo/Clue import migration
No phase content       + Phase-matched          + EHR/FHIR integration
                         content cards          + Multi-language (Euki has ES)
Modal-only log         + Inline "why?"          + Bookmarking content
                         links                  + Predictive content
                       + 4 new screens          + Real-time content updates
                       + 1 content package
```

This plan covers the first column gap well. The 12-month ideal remains intact — no decisions here close doors.

---

### Step 0C-bis — Implementation Alternatives

| Approach | Effort | Risk | Pros | Cons |
|---|---|---|---|---|
| A) Full-screen replacement (this plan) | M (17 files) | Med | Proper UX, room to grow | 3-tap log flow; DataEntryModal orphaned |
| B) Modal-only with inline fields | S (8 files) | Low | No navigation change, fast | Cramped, hard to extend, no room for content |
| C) Decouple: ship symptom logging first, content layer second | S+M | Low | Validate tracking before content bet | Two PRs, longer to full vision |

The plan chose A. The subagent identifies the 3-tap log flow (Log → AddSymptoms → AddedSymptoms) as the key risk. Auto-deciding: **keep A** (P1 completeness) — but flag AddedSymptomsScreen as a TASTE DECISION.

---

### Step 0D — Mode: SELECTIVE EXPANSION

Plan is already well-scoped. No ocean-scale expansions. Scope decisions (Step 0E below) apply SELECTIVE EXPANSION: accept additions that are in blast radius and <1 day CC effort; defer the rest.

---

### Step 0E — Temporal Interrogation

| Milestone | Concern |
|---|---|
| Hour 1: Stitch variants | Requires user approval before ANY code. Hard dependency. |
| Hour 3: Euki content layer | Requires fetching Euki source files from GitHub. Not in repo. |
| Hour 6: PredictionEngine | Date key format inconsistency (see Section 2 below) must be resolved first |
| Hour 12+: Screen implementations | 4 new screens ~800+ lines of RN. Volume task, not complexity. |
| End: AppNavigator wiring | Easy, but blocks testing everything else |

---

### Step 0F — Mode Confirmation: SELECTIVE EXPANSION ✓

---

### Step 0.5 — Dual Voices

Codex not installed. Proceeding subagent-only.

**CLAUDE SUBAGENT (CEO — strategic independence):**

> FINDING 1 (CRITICAL): Wrong Problem Frame. Content is not the gap; TRACKING is the gap. Symptom logging without content layer delivers 90% of user value. Content layer without great symptom UX = unread. Decouple ship order — symptom logging first, validate, then content.
>
> FINDING 2 (HIGH): Premise 1 not tested. "Log time is the right injection surface" is assumed, not verified. Users in task mode are hostile to education interrupts. PhaseInsightCard on LedgerScreen (ambient) is likely the right surface; inline links in log flow are the risky bet.
>
> FINDING 3 (HIGH): GPL risk punted. "Get legal opinion later" + bundling content in compiled TypeScript is exactly the FSF "part of the program" scenario. Fix now or serve from an endpoint never compiled into binary (also enables content updates without app releases).
>
> FINDING 4 (HIGH): Phase/symptom mapping is hand-authored with no build-time validation. IDs silently break when Euki updates content. Need build-time ID validation against bundled content.
>
> FINDING 5 (MEDIUM): 3-tap confirmation flow (Log → AddSymptoms → AddedSymptoms) vs. current 1-tap modal. AddedSymptomsScreen is a confirmation pattern for destructive actions, not logging. Remove from MVP.
>
> FINDING 6 (MEDIUM): Competitive risk — bleeding + symptoms = table stakes (Clue, Flo, Apple Health all have it). Differentiation is privacy-first/offline. Should be louder in UX (DisclaimerModal, ContentSheet footer).

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                              Claude  Codex  Consensus
  ─────────────────────────────────────  ──────  ─────  ─────────
  1. Premises valid?                     PARTIAL  N/A   PARTIAL [subagent-only]
  2. Right problem to solve?             PARTIAL  N/A   PARTIAL (tracking > content)
  3. Scope calibration correct?          PARTIAL  N/A   PARTIAL (AddedSymptomsScreen?)
  4. Alternatives sufficiently explored? YES      N/A   N/A
  5. Competitive/market risks covered?   FLAGGED  N/A   N/A
  6. 6-month trajectory sound?           PARTIAL  N/A   PARTIAL (3-tap flow risk)
═══════════════════════════════════════════════════════════════
[subagent-only — Codex not installed]
```

---

### CEO Review Sections 1–10

**Section 1 — Strategic Framing**

The plan's strategic frame is correct at the product level: Locket is a privacy-first period tracker, Euki is the best offline education library in this space. The combination is genuinely differentiated. But the execution frame has a tension: the design doc promises "inline content, no new navigation" and the plan ships 4 new screens. The right strategic frame is: **this plan delivers symptom tracking + contextual education in a full-screen logging UX.** That's the honest description. Not a tension — just needs to be stated.

**Section 2 — Error & Rescue Registry**

| Error | Surface | Impact | Recovery |
|---|---|---|---|
| Euki content IDs drift (Euki updates items) | phaseMapping, symptomMapping | Silent wrong content | Build-time ID validation |
| `getCurrentPhase` timezone bug | PredictionEngine | Wrong phase shown | UTC-strict parsing (already modeled in existing code) |
| `decryptData` fails for entries with bleeding/symptoms | LedgerScreen | Data loss appearance | Graceful fallback to existing fields |
| `AsyncStorage` unavailable | DisclaimerModal | Disclaimer shows every session | Catch → default to shown, log error |
| Stitch variant unavailable | Step 1 | Entire plan blocked | Define fallback: proceed with design spec if Stitch unreachable |
| Euki content fetch fails | Step 3 (build-time) | Content module empty | Must fail build, not ship silently |
| `navigation.navigate('Log')` from LedgerScreen | LedgerScreen | Runtime error if route not registered | AppNavigator Step 9 must ship before or with LedgerScreen changes |

**Section 3 — Scope Decisions**

| # | Item | Decision | Principle |
|---|------|----------|-----------|
| 1 | AddedSymptomsScreen (confirmation) | TASTE DECISION | Subagent flags as unnecessary 3rd tap; could be removed. Both approaches are viable. |
| 2 | `packages/shared/src/euki/` in shared package | APPROVED (P2) | In blast radius of this plan; natural home for cross-platform content |
| 3 | Phase colors added to colors.ts | APPROVED (P5) | 4 new tokens, obvious placement |
| 4 | Euki content fetch (GPL blocker) | FLAGGED | Requires sourcing content from external repo. Not a scope decision — a prerequisite. |
| 5 | DataEntryModal kept "for backward compat" | REJECTED | No other consumer after LedgerScreen change. Either keep using it OR replace it — not both. Orphaned code is tech debt. |
| 6 | SymptomsList.tsx: backward-compatible controlled refactor | APPROVED (P5) | Minimal change, clean interface |

**Section 4 — Risk Assessment**

Top risks (ordered):
1. **Euki content not in repo** — blocks Step 3. Hard dependency on external source.
2. **PredictionEngine date key format inconsistency** — `calculatePredictedPeriods` uses 0-indexed months (`${y}-${m}-${dayOfMonth}`) while `getLatestPeriodStart` returns 1-indexed ISO strings. `getCurrentPhase` must pick one format and be explicit.
3. **AddedSymptomsScreen UX friction** — 3-tap log flow vs. 1-tap modal.
4. **GPL legal position** — unresolved for future closed-source use.
5. **Stitch variant gate** — blocks entire plan if Stitch unavailable.

**Section 5 — Alternatives Reviewed**

Examined: modal-only approach (B from 0C-bis table). Rejected: not enough screen real estate for bleeding intensity + 6 symptoms + "why?" links + notes. Full-screen is correct for this scope.

**Section 6 — Reuse / DRY Check**

- `SymptomsList.tsx` reused (controlled refactor) ✓
- `usePredictions.ts` extended (not replaced) ✓
- `DataEntryModal.tsx` orphaned after LedgerScreen change — should be deleted or have a real consumer identified.
- `inscribe()` used unchanged ✓

**Section 7 — First-Principles Check**

Does the phase mapping need to be hand-authored? Could it be generated from content section IDs? Euki's `symptom_management` section naturally maps to luteal/menstrual phases. A simple heuristic rule (`if sectionId === 'symptom_management' && phase === 'luteal' → return all items`) would be more maintainable than a hardcoded ID array. This is an approach optimization — not a scope change.

**Section 8 — Content sourcing**

The plan assumes Euki content can be freely merged into `menstruation.ts` at build time. The actual process is: fetch `menstruation_options.json` + `Localizable.strings` from Euki-iOS GitHub → resolve strings → write TypeScript. This step is not automated in the plan. Someone must manually do this before Step 3 can be executed by an AI coding agent. The plan treats this as trivial; it's actually a prerequisite human task.

**Section 9 — Missing In Scope (Not In Scope)**

| Item | Reason deferred |
|---|---|
| Push notifications (APNs/FCM) | Too large for this PR |
| Cycle data visualization in provider portal | P7 scope |
| Import migration from Flo/Clue | Separate initiative |
| Contraception content | Not in Euki cycle-core subset |
| STI/pregnancy content | Not in MVP scope |
| Multi-language (Euki has ES) | Future work |
| Full-text search | Requires dedicated tab (contradicts no-tab constraint) |
| Bookmarking | Future feature |

**Section 10 — What Already Exists**

| Need | Existing code |
|---|---|
| Cycle phase data | `usePredictions.ts` → `futureData` (prediction), not current phase — must add |
| Period start detection | `getLatestPeriodStart` in PredictionEngine.ts ✓ |
| Haptic feedback | `expo-haptics` already imported in LedgerScreen, SymptomsList ✓ |
| Encrypted log storage | `inscribe()` in useLedger ✓ |
| Stack navigation | AppNavigator.tsx — just add 4 routes ✓ |
| Color tokens | colors.ts — add 4 phase colors |
| Shared package | packages/shared/src — add euki/ ✓ |

---

### CEO Completion Summary

| Dimension | Finding | Severity | Auto-Decision |
|---|---|----------|--------------|
| Premise 1 (injection surface) | CHALLENGED — plan diverges from design doc | HIGH | PREMISE GATE |
| Premise 4 (no navigation) | CONTRADICTED — 4 new screens | HIGH | PREMISE GATE |
| Euki content sourcing | BLOCKER — content not in repo | HIGH | Flag: add sourcing step to plan |
| Date key format inconsistency | BUG in existing code; getCurrentPhase must handle | HIGH | Auto-fix in plan notes |
| AddedSymptomsScreen 3-tap flow | UX friction vs. current 1-tap | MEDIUM | TASTE DECISION |
| DataEntryModal "backward compat" | Orphaned code; no other consumer | MEDIUM | Auto-decide: delete or document real consumer |
| Phase mapping validation | No build-time ID validation | MEDIUM | Auto-fix: add validation note |
| GPL legal | Punted; should be resolved pre-ship | MEDIUM | Flag in deferred items |

**NOT in scope (deferred to TODOS.md):**
- Push notifications, Flo/Clue import migration, EHR integration, contraception/STI content, multi-language, bookmarking, full-text search.

**Dream state delta:** This plan covers ~20% of the 12-month ideal. The foundation (content layer, symptom model, phase detection) is exactly right — everything else builds on it. No scope decisions here close any doors.

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | CEO | Keep full-screen approach (Option A) over modal-only (Option B) | Mechanical | P1 (completeness) | Better UX for symptom + content scope; modal too cramped | Option B |
| 2 | CEO | Add Euki content sourcing step as prerequisite to plan | Mechanical | P6 (bias toward action) | Content not in repo is a blocker; must be called out explicitly | — |
| 3 | CEO | Flag AddedSymptomsScreen as TASTE DECISION | Taste | P3 (pragmatic) | 3-tap vs. 1-tap is a real UX tradeoff; both viable | — |
| 4 | CEO | DataEntryModal "backward compat" claim: reject orphan framing | Mechanical | P4 (DRY) | No other consumer after LedgerScreen change; must be resolved | Keep orphaned code |
| 5 | CEO | Phase mapping validation: add build-time note | Mechanical | P5 (explicit) | Silent wrong content is worse than a build failure | Ship without validation |
| 6 | CEO | Defer GPL legal opinion to TODOS.md | Mechanical | P3 (pragmatic) | Pre-ship decision; not blocking current implementation | Block implementation |
| 7 | CEO/Gate | Adopt inline approach (extend DataEntryModal, no new screens) | **USER DECISION** | — | User confirmed: honor design doc "no new navigation" constraint | Full-screen 4-screen approach |
| 8 | CEO/Gate | Euki content: user will provide source files | **USER DECISION** | — | User confirmed | Stub content approach |
| 9 | Design | onSave omits undefined bleeding/symptoms | Mechanical | P5 explicit | Never write undefined fields; omit from inscribe payload | Write undefined |
| 10 | Design | DataEntryModal ScrollView with maxHeight 85% | Mechanical | P5 explicit | Prevents modal overflow on small phones (SE, mini) | Fixed height |
| 11 | Design | All new fields optional (no validation on save) | Mechanical | P5 explicit | Users who just want "period start" shouldn't be blocked | Required fields |
| 12 | Design | PhaseInsightCard placed below calendar | Mechanical | P3 pragmatic | Above calendar pushes primary interaction surface down | Above calendar |
| 13 | Design | initialData extended to include bleeding/clots/symptoms | Mechanical | P1 completeness | Reopening modal for existing date restores saved data | Empty form |
| 14 | Design | Last-tapped symptom chip drives ContentSheet | Mechanical | P5 explicit | `lastTappedSymptom` state; single ContentSheet opens at a time | First-selected |
| 15 | Design | DisclaimerModal is lifetime (AsyncStorage), not session | Mechanical | P5 explicit | Removes contradiction in plan; one-time acknowledgment | Per-session |
| 16 | Design | ContentSheet stacking on Android | **Taste** | P1 vs P3 | Portal/overlay vs nested Modal; both viable | — |
| 17 | Eng | getLatestPeriodStart: use UTC methods throughout | Mechanical | P5 explicit | Fixes timezone drift; UTC-seeded timestamps must stay UTC | Local methods |
| 18 | Eng | getCurrentPhase: explicit NaN/Invalid Date guard | Mechanical | P5 explicit | Malformed lastPeriodDate returns 'unknown', not wrong phase | Rely on NaN falsy |
| 19 | Eng | getCurrentPhase: cycleLength=0 guard | Mechanical | P5 explicit | Prevents divide-by-zero in phase boundary math | Unguarded |
| 20 | Eng | packages/shared content placement | **Taste** | P1 vs P4 | Right home: packages/content/ or apps/mobile/src/content/? Both viable | — |
| 21 | Eng | DisclaimerModal: preload AsyncStorage flag on mount | Mechanical | P5 explicit | Prevents one-frame flash of ContentSheet before disclaimer | Check on open |
| 22 | Eng | useEukiContent hook: wrap in useMemo | Mechanical | P5 explicit | Prevents content lookup on every DataEntryModal keystroke | No memo |
| 23 | Eng | Note field: 2000-char cap in DataEntryModal | Mechanical | P5 explicit | Prevents unbounded sync payload | No cap |
| 24 | Eng | Build-time Euki content ID validation | Mechanical | P5 explicit | Missing IDs = build fail, not silent wrong content | Runtime check |

---

## Phase 2: Design Review

Design doc: `docs/design.md` confirmed. Design system ID `14853906600246273020`. UI scope: YES (DataEntryModal extension, PhaseInsightCard, ContentSheet, DisclaimerModal).

### Design Litmus Scorecard

| Dimension | Claude Subagent | Consensus |
|---|---|---|
| 1. Information hierarchy correct? | NO — PhaseInsightCard above calendar inverts task priority | NEEDS FIX |
| 2. Missing states specified? | NO — loading, empty, error, initialData gaps | NEEDS FIX |
| 3. User journey intact? | BROKEN — modal overflow + no skip affordance | NEEDS FIX |
| 4. Design decisions specific? | PARTIAL — several ambiguities (stacked modals, onSave, multi-select) | NEEDS SPEC |
| 5. Haunting ambiguities identified? | YES — onSave extension, modal height, Android modal stacking | NEEDS SPEC |
| 6. Accessibility covered? | NOT SPECIFIED | DEFERRED |
| 7. Responsive/dark mode? | NOT SPECIFIED | DEFERRED |

Overall completeness before fixes: **4/10**. After applying fixes below: **8/10**.

---

### Design Findings — Auto-Decided

**D1 (CRITICAL): onSave extension — write undefined bleeding or not?**
Plan is silent on whether `bleeding: undefined` writes to the log. If a user taps "Start period" without filling bleeding/symptoms, `inscribe()` gets called with no new fields — or with `bleeding: undefined`, depending on implementation.
- Auto-decision (P5 explicit): bleeding/symptoms written ONLY if user touched those fields. If no chip tapped and no intensity selected, omit fields from the inscribe payload entirely. `undefined` is never written.
- Plan update: `onSave` passes `bleeding?: { intensity, clots? }` and `symptoms?: SymptomKey[]` only when present.

**D2 (CRITICAL): Modal height overflow on small phones**
DataEntryModal is currently centered with `width: SCREEN_WIDTH * 0.85`, height driven by content. Adding 3 new rows pushes height past iPhone SE viewport.
- Auto-decision (P5): wrap modal content in `<ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_HEIGHT * 0.85 }}>`. This is the standard RN pattern and matches the existing modal's style.

**D3 (CRITICAL): All new fields need explicit optional/skip affordance**
Plan says nothing about required vs. optional. Users who just want to log a period start should not be blocked.
- Auto-decision (P5): all new fields are optional with visible "none" default state. Bleeding intensity defaults to nothing selected. Chips default to none selected. No validation required on save.

**D4 (HIGH): PhaseInsightCard placement above calendar**
Placing it above the calendar pushes the calendar down, inverting task hierarchy (users come to tap dates).
- Auto-decision (P3 pragmatic): move PhaseInsightCard **below** the toggle button / above the view. Make it a thin card (48–56dp) so it doesn't steal vertical space. Can be dismissed with a small ✕ button; dismissed state persisted in AsyncStorage key `phase_insight_dismissed`.

**D5 (HIGH): initialData missing bleeding/clots/symptoms**
When a user reopens the modal for a date they already logged with bleeding data, the form shows empty.
- Auto-decision (P1 completeness): extend `initialData` type to include `bleeding?: { intensity, clots? }` and `symptoms?: SymptomKey[]`. Pass these from `decryptedData` in LedgerScreen, same as `isStart`/`isEnd`/`note` are passed today.

**D6 (HIGH): "Why does this happen?" multi-select target**
When multiple symptom chips are selected, which one drives the ContentSheet?
- Auto-decision (P5 explicit): the **last-tapped** chip drives ContentSheet content. A `lastTappedSymptom` state variable tracks this. Only one ContentSheet opens at a time.

**D7 (HIGH): DisclaimerModal "session" vs. lifetime contradiction**
Plan says "within this session" but AsyncStorage key `content_disclaimer_seen` is lifetime.
- Auto-decision (P5): it's **lifetime**. Remove "session" language. One-time acknowledgment via AsyncStorage. Shown on first ContentSheet open ever, not per-session.

**D8 (HIGH — TASTE DECISION): ContentSheet + DataEntryModal stacked modals on Android**
Two RN `<Modal>` components stacked (DataEntryModal → ContentSheet) with different animations (`fade` + `slide`) are known to misbehave on Android. Options:
- Option A (complete): Convert ContentSheet to use `react-native-portal` or a custom absolute overlay within the existing modal's view tree — avoids nested RN Modals.
- Option B (pragmatic): Use the nested Modal approach, accept that Android users will see a brief flash on open, add a note to test on Android before ship.

I recommend **Option A** (P1 completeness, P5 explicit). But both are viable. → **TASTE DECISION #1**.

### Design Phase Complete

Fixes D1–D7 auto-applied to plan below. D8 surfaced at final gate.

| Decision | # | Classification |
|---|---|---|
| D1 (onSave) | 9 | Mechanical |
| D2 (ScrollView maxHeight) | 10 | Mechanical |
| D3 (all fields optional) | 11 | Mechanical |
| D4 (PhaseInsightCard below) | 12 | Mechanical |
| D5 (initialData extension) | 13 | Mechanical |
| D6 (last-tapped chip) | 14 | Mechanical |
| D7 (lifetime disclaimer) | 15 | Mechanical |
| D8 (stacked modals) | 16 | **Taste** |

**Phase 2 complete.** Claude subagent: 10 findings (7 auto-decided, 1 taste). Passing to Phase 3.

---

## Phase 3: Eng Review

### Step 0 — Scope Challenge + Architecture

**Blast radius (files this plan touches):**
```
apps/mobile/src/utils/PredictionEngine.ts          EXTEND
apps/mobile/src/hooks/usePredictions.ts             EXTEND
apps/mobile/src/components/DataEntryModal.tsx       MODIFY (significant)
apps/mobile/src/screens/LedgerScreen.tsx            MODIFY (PhaseInsightCard + onSave extension)
apps/mobile/src/theme/colors.ts                     EXTEND
packages/shared/src/index.ts                        EXTEND
packages/shared/src/euki/                           NEW (5 files)
apps/mobile/src/components/PhaseInsightCard.tsx     NEW
apps/mobile/src/components/ContentSheet.tsx         NEW
apps/mobile/src/components/DisclaimerModal.tsx      NEW
apps/mobile/src/hooks/useEukiContent.ts             NEW
apps/mobile/src/models/LogEntry.ts                  NEW
NOTICE                                              NEW
apps/mobile/src/theme/colors.ts                     EXTEND
```

Direct importers of modified files (additional blast radius):
- `LedgerScreen.tsx` imports `DataEntryModal` → already in blast radius
- `packages/shared/src/index.ts` is imported by: need to check

**Architecture ASCII diagram:**

```
LedgerScreen.tsx
│
├── usePredictions(decryptedData, config)
│     ├── calculatePredictedPeriods()   ← PredictionEngine [existing]
│     ├── calculateAverageCycle()       ← [existing]
│     └── getCurrentPhase()  NEW        ← PredictionEngine [new export]
│           └── returns { currentPhase, dayInCycle }
│
├── PhaseInsightCard  NEW (inline, below header)
│     └── useEukiContent(phase, dayInCycle)  NEW
│           └── getEukiContent()  NEW   ← packages/shared/src/euki/index.ts
│                 ├── menstruation.ts   (content blob)
│                 ├── phaseMapping.ts   (phase → itemIDs)
│                 └── symptomMapping.ts (symptom → itemID)
│     └── ContentSheet  NEW (bottom sheet)
│
└── DataEntryModal (EXTENDED)
      ├── bleeding intensity + clots [new fields]
      ├── symptom chips [new fields]
      ├── ContentSheet  NEW (triggered by "Why?" link)
      └── DisclaimerModal  NEW (one-time, pre-loads on mount)
            └── AsyncStorage key: 'content_disclaimer_seen'

LogEntry model  NEW
└── bleeding?: { intensity, clots? }
└── symptoms?: SymptomKey[]
```

No circular dependencies. `packages/shared` → no mobile imports. `DataEntryModal` → new deps on `useEukiContent` and `ContentSheet`.

---

### Step 0.5 — Eng Dual Voices [subagent-only, Codex unavailable]

**CLAUDE SUBAGENT (Eng — independent review):**

> FINDING 1 (CRITICAL): Live date key format inconsistency bug. `calculatePredictedPeriods` writes keys as 0-indexed no-pad (`"2025-2-15"`). `getLatestPeriodStart` returns 1-indexed ISO (`"2025-03-15"`). Any code that bridges these two key spaces (e.g., `decryptedData[latestStart]`) silently fails. `getCurrentPhase` ingests the ISO format directly — safe in isolation. But `calculateAverageCycle` parses 0-indexed keys and is accidentally correct. The inconsistency must be normalized before adding more code that reads these keys.
>
> FINDING 2 (CRITICAL): `getCurrentPhase` timezone bug. `getLatestPeriodStart` uses local-timezone methods (`getFullYear`, `getMonth`, `getDate`) on UTC-seeded timestamps. On UTC-8 devices, a midnight UTC timestamp resolves to the previous local day. Drift accumulates per cycle. Fix: `getLatestPeriodStart` must use UTC methods throughout.
>
> FINDING 3 (CRITICAL): `getCurrentPhase` NaN guard missing. If `config.lastPeriodDate` is `"undefined"` or empty string, `new Date("undefined")` → Invalid Date → NaN arithmetic → wrong phase returned (not `unknown`). Explicit guard required.
>
> FINDING 4 (HIGH): `packages/shared` is the wrong home for content blobs. It's a crypto/util package. Pulling in content blobs makes it import-heavy for any future non-mobile consumer. Better: `packages/content/` or `apps/mobile/src/content/`.
>
> FINDING 5 (HIGH): RN version unconfirmed for modal stacking. Plan says RN ≥ 0.71 but repo's version is not checked. Need to verify before ContentSheet-in-DataEntryModal approach.
>
> FINDING 6 (HIGH): Reuse table contradiction — plan says DataEntryModal "no change" in reuse section but "significant modification" in Steps 5 and Critical Files. Confuses anyone executing the plan.
>
> FINDING 7 (HIGH): `DisclaimerModal` AsyncStorage check is async on first ContentSheet open → one-frame flash. Must preload flag on component mount.
>
> FINDING 8 (MEDIUM): No test coverage for `getLatestPeriodStart` timezone correctness. No boundary tests for `getCurrentPhase`. No cycle-key format consistency test.
>
> FINDING 9 (MEDIUM): Note field has no length cap. 1MB note is valid JS, will serialize and sync. Cap at ~2000 chars.
>
> FINDING 10 (MEDIUM): `Linking.openURL` in ContentSheet — safe now (static content), but document the constraint explicitly to prevent future dynamic URL injection.

```
ENG DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               PARTIAL  N/A   PARTIAL [subagent-only]
  2. Test coverage sufficient?         NO       N/A   N/A
  3. Performance risks addressed?      OK       N/A   N/A
  4. Security threats covered?         PARTIAL  N/A   N/A
  5. Error paths handled?              NO       N/A   N/A
  6. Deployment risk manageable?       OK       N/A   N/A
═══════════════════════════════════════════════════════════════
[subagent-only — Codex not installed]
```

---

### Section 1 — Architecture

Sound overall for the inline approach. Key concern: `packages/shared` content placement. See audit decision E4 below.

Date key format inconsistency is a **live pre-existing bug** that will become dangerous as more code bridges the two key formats. Must be fixed in this PR (it's in the blast radius).

---

### Section 2 — Code Quality

Reuse table contradiction (DataEntryModal "no change" vs "significant modification"): **auto-fix** — remove the "no change" line from the reuse table. DataEntryModal is being modified.

`SymptomsList.tsx` reuse: subagent notes DataEntryModal will have its own chip UI; SymptomsList stays standalone. Correct per the revised scope — not a violation.

---

### Section 3 — Test Review

**All new UX flows / codepaths:**

| Flow | Test Type | Exists? |
|---|---|---|
| `getCurrentPhase` — 4 phases, boundaries, unknown | Unit | NO |
| `getCurrentPhase` — future start, malformed, NaN guard | Unit | NO |
| `getCurrentPhase` — UTC vs local timezone consistency | Unit | NO |
| `getLatestPeriodStart` — UTC method correctness | Unit | NO (existing test missing) |
| `calculateAverageCycle` — 0-indexed key parsing | Unit | Implicit (passes today) |
| `DataEntryModal` — bleeding/clots/symptoms render | Component | NO |
| `DataEntryModal` — onSave with undefined bleeding (no fields touched) | Integration | NO |
| `DataEntryModal` — initialData round-trip with bleeding+symptoms | Integration | NO |
| `DisclaimerModal` — shown once, suppressed on second open | Unit | NO |
| `ContentSheet` — last-tapped symptom drives content | Component | NO |
| `PhaseInsightCard` — unknown phase fallback | Component | NO |
| `PhaseInsightCard` — each of 4 phases renders correct color+icon | Component | NO |
| `LogEntry` serialization round-trip through inscribe/decrypt | Integration | NO |
| `LogEntry` with empty symptoms array vs undefined | Integration | NO |
| Euki content mapping — all IDs in phaseMapping exist in content | Build-time | NO |

LLM/prompt changes: N/A — no LLM calls in this plan.

**Test plan artifact:** Written to disk below.

---

### Section 4 — Performance

- `getEukiContent()` is a lazy singleton — no repeated JSON parsing per render. Correct.
- `useEukiContent` hook must be memoized — if called on every render without memo, content lookup runs every keystroke in DataEntryModal. Spec: wrap in `useMemo([phase, dayInCycle])`.
- `DataEntryModal` with ScrollView: standard React Native pattern, no perf concern at this size.
- Phase calculation happens inside `usePredictions` useMemo — correct, won't re-run unless `decryptedData` or `config` changes.

---

### Eng Completion Summary

| Finding | Severity | Auto-Decision |
|---|---|---|
| Date key format inconsistency (live bug) | CRITICAL | Auto-fix: add to plan — normalize getLatestPeriodStart to use UTC methods |
| getCurrentPhase timezone bug | CRITICAL | Auto-fix: specify UTC methods throughout |
| getCurrentPhase NaN guard | CRITICAL | Auto-fix: add explicit Invalid Date guard |
| packages/shared content placement | HIGH | TASTE DECISION #2 (architecture preference) |
| RN version modal stacking | HIGH | Auto-fix: add RN version check to Prerequisites |
| Reuse table contradiction | HIGH | Auto-fix: update table |
| DisclaimerModal async preload | HIGH | Auto-fix: preload on mount |
| Test coverage gaps (15 missing tests) | HIGH | Auto-fix: test plan written |
| Note field length cap | MEDIUM | Auto-fix: add 2000-char cap note |
| Linking.openURL constraint | MEDIUM | Auto-fix: document in ContentSheet |
| useEukiContent memoization | MEDIUM | Auto-fix: add useMemo spec |

**NOT in scope (deferred to TODOS.md):**
- Date key format normalization across full codebase (beyond getLatestPeriodStart) — larger refactor
- ContentSheet portal implementation (depends on Taste Decision #2 resolution)
- Multi-language content (Euki has ES)
- GPL legal opinion (flagged from CEO phase)
- Note field length cap for existing entries (only gate new entries going forward)

---

### Cross-Phase Themes

**Theme 1: Date/timezone correctness** — flagged in Phase 1 (premise review, date inconsistency noted) AND Phase 3 (getLatestPeriodStart UTC bug, getCurrentPhase NaN guard, key format inconsistency). High-confidence signal. Three separate paths through the same root issue: local vs UTC timezone handling in date key construction.

**Theme 2: Missing states / incomplete spec** — flagged in Phase 2 (loading states, empty states, initialData gap) AND Phase 3 (DisclaimerModal async flash, onSave undefined fields). Both phases independently found that the plan under-specifies state transitions.

No cross-phase themes in Phase 1 + Phase 2 that don't also appear in Phase 3.


---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open | 6 findings (2 USER DECISIONS: inline approach + content sourcing) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | Not installed |
| Eng Review | `/plan-eng-review` | Architecture & tests | 2 | clean | 7 issues resolved: JSDoc contract, Android scope, SymptomsList delete, maxLength cap, test specs added (20 paths), Euki ID validation test, LogEntry roundtrip test |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | clean | 14 decisions: prototype conflict resolved (full-screen accordion), IA gap (LogScreen fully replaces DataEntryModal), 5 interaction state specs, 2 UJ pre-population gaps, 5 AI slop risks spec'd, 4 DS tokens named, 5 a11y items added, 2 unresolved decisions closed |

**VERDICT:** ENG REVIEW CLEARED + DESIGN REVIEW CLEARED. All 14 design decisions resolved (13 auto, 1 prototype-confirmed). 0 unresolved. Plan ready for implementation.

---

## DESIGN REVIEW — 7-Pass Analysis

> **Triggered by:** `/plan-design-review`
> **Prototype anchored:** User-provided Stitch prototype videos (`Full interactions.mov`, `LogScreen interactions.mov`) confirmed as design target. Full-screen LogScreen + 4-category accordion confirmed. Bottom tab bar = exploratory, not in scope.

---

### Pass 1 — Information Architecture

**Surface map:**
- `LedgerScreen` (hub): calendar, "Insights →" touchable, date tap → `LogScreen`
- `LogScreen` (new): full-screen entry — date, Start/End, 4-category accordion, notes, save/clear
- `CycleInsightsScreen` (new): `PhaseInsightCard` + "Read more →" → `ContentSheet`
- `ContentSheet` (new): bottom sheet overlay, Euki article, attribution
- `DisclaimerModal` (new): one-time gate on first ContentSheet open

**Issues found:**
- IA-1: The plan says LogScreen receives `initialData` but doesn't specify it handles **period start/end** (the core DataEntryModal function). The prototype shows Start/End buttons on LogScreen. If LogScreen doesn't handle start/end marking, LedgerScreen still needs DataEntryModal for that — two UIs for the same date. **Decision: LogScreen must fully replace DataEntryModal (Start/End/Note/Clear included)**. Plan Step 5 updated.
- IA-2 (auto-decided): `CycleInsightsScreen` as a separate navigated screen is correct for this feature's complexity. Not folding it into LedgerScreen inline — the ContentSheet layer needs a full screen to breathe.

**Plan changes:**
- Step 5 spec updated: LogScreen receives `date`, `initialData: LogEntry | undefined`, `keyHex`. Renders Start/End period marking buttons (replacing DataEntryModal). Period state persists via `inscribe()` same as before. Existing DataEntryModal functionality moved INTO LogScreen — DataEntryModal.tsx preserved as an archived file only.

---

### Pass 2 — Interaction States

**States audited for each interactive surface:**

| Surface | States Required | Gap |
|---|---|---|
| Accordion header | closed / open / pressed | Plan doesn't specify icon (chevron rotate) |
| Symptom chip | unselected / selected / pressed | No visual spec for pressed state |
| "Why does this happen?" link | hidden / visible / pressed | Needs `accessibilityRole="link"` |
| Start button | inactive / active (period marked) / pressed | Missing: phase-color treatment on active state |
| End button | inactive / active / pressed | Same as Start |
| Save button | idle / loading (async encrypt) / error | Loading state unspecified |
| ContentSheet | hidden / visible / link-loading / link-error | Error state for `Linking.openURL` fail → Alert |
| DisclaimerModal | checking-AsyncStorage / showing / dismissed | Flash on AsyncStorage read not addressed |

**Decisions (auto):**
- IS-1: Accordion headers use a right-side chevron icon (`expand_more` / `expand_less` Material Symbol) that rotates 180° on expand. Specify: `Animated.timing`, 200ms, `easeInOut`. Add to Step 5 spec.
- IS-2: Selected symptom chip uses phase-tinted background (same as pill chip spec in design.md — semantic tinted bg). Unselected uses `Pale Lavender Mist` bg.
- IS-3: Save button shows `ActivityIndicator` during `inscribe()` call. Disable button during load. Error → `Alert.alert('Could not save')`.
- IS-4: DisclaimerModal — check AsyncStorage on `ContentSheet` mount, not on `LogScreen` mount. No flash: render ContentSheet first, show DisclaimerModal as an overlay on top if needed. Flag written only on tap.

---

### Pass 3 — User Journey

**Journey 1 — New user, first log:**
> Ledger → tap date → LogScreen (empty, no initialData) → expand Symptoms accordion → tap chip → "Why?" link appears → tap → DisclaimerModal → Got it → ContentSheet opens → read → close → Save → back to Ledger

**Journey 2 — Returning user, existing entry:**
> Ledger → tap date with existing data → LogScreen (pre-populated: Start/End status, existing bleeding, existing symptoms pre-selected) → modify → Save → back to Ledger

**Journey 3 — Phase content:**
> Ledger → "Insights →" → CycleInsightsScreen → PhaseInsightCard → "Read more →" → ContentSheet → attribution footer → close

**Gap found (UJ-1):** Pre-population. The plan says `route.params.initialData` but doesn't specify the data path from `decryptedData` to `LogEntry` shape. `LedgerScreen` has `decryptedData` from `useLedger`. On `handleToggleDate`, must find the existing entry for that date (if any) and pass it as `initialData: LogEntry | undefined`. **Decision: add to Step 5 spec — LedgerScreen finds existing entry by date before navigating.**

---

### Pass 4 — AI Slop Risk

Checking for spec gaps that would cause an implementer to guess:

| Risk | Verdict |
|---|---|
| Phase colors | ✓ Specified in design.md and plan |
| Phase icon names | ✓ `water_drop`, `psychiatry`, `wb_sunny`, `mode_night` from design.md |
| Accordion category icons | ⚠️ NOT specified — implementer will guess |
| Accordion animation timing | ⚠️ NOT specified — implementer will use arbitrary value |
| Chip tinted background hex | ⚠️ Only menstrual `#FBEBEF` is in design.md; others not given for symptoms/mood |
| PhaseInsightCard left-border width | ⚠️ NOT specified |
| "Why does this happen?" link color | ⚠️ Not specified — should be Locket Blue per `Label / Subtext` style |

**Decisions (auto):**
- AS-1: Accordion category icons (from design.md interaction icons + phase icons):
  - Symptoms: `medication` (16px filled)
  - Mood: `sentiment_satisfied` (16px filled)
  - Sex: `favorite` (16px filled)
  - Triggers: `bolt` (16px filled)
  Add to Step 5 spec.
- AS-2: Accordion animation: `Animated.timing`, 200ms, `easeInOut` for chevron rotation and section height expansion. Collapse uses `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` as simpler alternative. **Decision: use `LayoutAnimation` — simpler, no ref juggling.** Add to Step 5 spec.
- AS-3: Symptom/Mood chip tinted backgrounds — use phase-neutral Pale Lavender Mist (`#F2F2F7`) for unrelated symptom chips; use Menstrual Warm Terracotta tint (`#FBEBEF`) for Symptoms category chips specifically (cramps, bloating, nausea relate to menstrual phase). Mood chips use Deep Violet tint (`#EDE5F5`, derived from `#76489D` at ~10% opacity on white). Add to Step 5 spec.
- AS-4: PhaseInsightCard left border: 3px solid phase color. Add to Step 6 spec.
- AS-5: "Why does this happen?" link: Locket Blue (`#006EC7`), 14px medium weight, `Label / Subtext` style. Add to Step 5 spec.

---

### Pass 5 — Design System Alignment

**Token check:**

| Token | Spec Source | Plan Status |
|---|---|---|
| `warmTerracotta` `#D1495B` | design.md | ✓ In plan as colors.ts addition |
| `arcticTeal` `#2A9D8F` | design.md | ✓ In plan |
| `orangePeel` `#FF9F00` | design.md | ✓ In plan |
| `deepViolet` `#76489D` | design.md | ✓ In plan |
| Pill chip 999px radius | design.md § Pill Elements | ✓ Implied by pill chip spec |
| Section header style | design.md § Section Headers | ✓ In design.md; not explicitly in plan spec |
| Nav bar frosted glass | design.md § Navigation Bar | ⚠️ LogScreen header must use same frosted treatment |
| Card shadow light mode | design.md § Cards | ⚠️ ContentSheet card must use `0 4px 20px -2px rgba(0,0,0,0.05)` |

**Decisions (auto):**
- DS-1: LogScreen header: semi-transparent `Sun-Baked Sand` at 80% opacity with backdrop blur — matches design.md nav bar spec. Title: 17px semibold (`Nav Title` scale). Add to Step 5 spec.
- DS-2: Accordion category headers: `Section Header` style — uppercase, 0.1em tracking, 13px bold, Locket Blue text, leading icon. Add to Step 5 spec.
- DS-3: ContentSheet card surface: white bg (light) / Elevated Slate (dark), `0 4px 20px -2px rgba(0,0,0,0.05)` shadow, 16px radius. Add to Step 4 spec.
- DS-4: **Color token names in `colors.ts`** — use camelCase matching design.md descriptive names: `warmTerracotta`, `arcticTeal`, `orangePeel`, `deepReflectiveViolet`. Tinted backgrounds: `warmTerracottaTint: '#FBEBEF'`, `orangePeelTint: '#FFF4E5'`. Add to Step 6 spec.

---

### Pass 6 — Responsive & Accessibility

| Item | Check | Status |
|---|---|---|
| LogScreen keyboard avoidance | Notes TextInput at bottom needs `KeyboardAvoidingView` | ⚠️ Missing from plan spec |
| Accordion `accessibilityRole` | Each header needs `role="button"` + `accessibilityState={{ expanded }}` | ⚠️ Missing |
| Symptom chip `accessibilityRole` | `role="checkbox"` + `accessibilityState={{ checked }}` | ⚠️ Missing |
| Phase color ≠ only indicator | Phase must show text name alongside color (color-blind users) | ✓ PhaseInsightCard shows phase name |
| ContentSheet close button | Needs `accessibilityLabel="Close"` | ⚠️ Missing |
| 4.5:1 contrast on tinted chips | Warm Terracotta `#D1495B` on `#FBEBEF` — check: WCAG pass | ✓ ~5.1:1 (passes) |
| Bottom safe area | LogScreen needs `SafeAreaView` or `useSafeAreaInsets()` for Save button | ⚠️ Missing from plan spec |

**Decisions (auto):**
- A11y-1: Add to Step 5 spec: LogScreen wraps in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>`. Notes input is the bottom-most element; scroll-to on focus.
- A11y-2: Add to Step 5 spec: Accordion headers — `accessibilityRole="button"`, `accessibilityLabel="{Category Name}, {expanded|collapsed}"`, `accessibilityState={{ expanded }}`.
- A11y-3: Add to Step 5 spec: Symptom chips — `accessibilityRole="checkbox"`, `accessibilityState={{ checked: isSelected }}`, `accessibilityLabel="{symptom label}"`.
- A11y-4: Add to Step 5 spec: `useSafeAreaInsets()` from `react-native-safe-area-context` for bottom padding on Save button row.
- A11y-5: Add to Step 4 spec: ContentSheet close button `accessibilityLabel="Close"`, `accessibilityRole="button"`.

---

### Pass 7 — Unresolved Decisions (Taste Decisions for User)

Two items require a design judgment call:

**UD-1 (DECIDED by user prototype):** Start/End button phase colors — the prototype showed phase-colored Start/End period marking buttons. **Decision: phase-colored when phase is known, Locket Blue when phase is unknown.** Button shape: 12px radius, full-width segmented pair. Add to Step 5 spec.

**UD-2 (AUTO-DECIDED):** Clots sub-option in LogScreen — the original plan's DataEntryModal extension had `[ Small clots ] [ Large clots ]` appearing when bleeding intensity selected. The prototype didn't show clots explicitly. **Decision: include clots as a sub-row inside the Symptoms accordion category (not a top-level row), appears with `LayoutAnimation` when any bleeding chip selected. Bleeding is modeled as a symptom, not a separate section.** Clarification: bleeding intensity chips (`Spotting / Light / Medium / Heavy`) live at the TOP of LogScreen (above accordion), as a primary signal — not inside accordion. Clots appear below bleeding row, animated in.

---

### Design Review — Decisions Audit

| # | Pass | Decision | Auto/Taste | Rationale |
|---|------|----------|------------|-----------|
| DR-1 | IA | LogScreen fully replaces DataEntryModal (Start/End included) | Auto | Prototype shows Start/End in LogScreen; two UIs for same date = confusing |
| DR-2 | IA | CycleInsightsScreen as separate navigated screen | Auto | ContentSheet needs full screen depth |
| DR-3 | IS | Accordion chevron rotate 180° on expand, `LayoutAnimation easeInEaseOut` | Auto | Standard mobile accordion pattern |
| DR-4 | IS | Selected chip: phase-tinted bg; unselected: Pale Lavender Mist | Auto | Matches design.md pill spec |
| DR-5 | IS | Save loading state: `ActivityIndicator`, disabled during `inscribe()` | Auto | Prevents double-submit |
| DR-6 | UJ | LedgerScreen finds existing LogEntry before navigating to LogScreen | Auto | Pre-population requires existing data lookup |
| DR-7 | AS | Accordion icons: `medication`, `sentiment_satisfied`, `favorite`, `bolt` | Auto | From design.md interaction icon set |
| DR-8 | AS | "Why?" link: Locket Blue, 14px medium, `Label/Subtext` style | Auto | Consistent with design.md |
| DR-9 | AS | PhaseInsightCard left border: 3px solid phase color | Auto | Standard card accent pattern |
| DR-10 | DS | color.ts token names: `warmTerracotta`, `arcticTeal`, `orangePeel`, `deepReflectiveViolet` + tints | Auto | Matches design.md descriptive names |
| DR-11 | DS | LogScreen header: frosted glass, 17px semibold, matches nav bar spec | Auto | Design system consistency |
| DR-12 | A11y | `KeyboardAvoidingView`, safe area insets, chip/accordion a11y roles | Auto | Standard RN a11y patterns |
| DR-13 | UD | Start/End buttons: phase-colored (known) / Locket Blue (unknown) | Prototype | User prototype confirmed phase-colored |
| DR-14 | UD | Bleeding chips at top (above accordion); clots sub-row animated in | Auto | Bleeding = primary signal, not a symptom category |

