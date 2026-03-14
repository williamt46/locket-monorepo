# Phase 3 Handoff: Onboarding Flow ("Establish Ledger")

**Status:** ✅ Complete
**Date:** 2026-02-24
**Conversation:** `6c2d09c9-f1f9-458a-b8b1-cef2b91fe75a`

---

## Completed Work

### 3.1 — Data Layer
- [x] **[NEW]** `apps/mobile/src/models/UserConfig.ts` — typed interface, clamping constants (`PERIOD_MIN=1, PERIOD_MAX=20, CYCLE_MIN=10, CYCLE_MAX=100`), `clampValue()`, `createDefaultUserConfig()`, `todayUTC()`
- [x] **[MODIFY]** `apps/mobile/src/services/StorageService.js` — added `saveUserConfig()` / `getUserConfig()` using `expo-secure-store`

### 3.2 — UI Components
- [x] **[NEW]** `apps/mobile/src/components/onboarding/StepWelcome.tsx` — stateless text intro
- [x] **[NEW]** `apps/mobile/src/components/onboarding/StepLastPeriod.tsx` — FlatList date picker (last 60 days), optimized with `getItemLayout`
- [x] **[NEW]** `apps/mobile/src/components/onboarding/StepNumberPicker.tsx` — reusable chevron picker with ≥48px touch targets, min/max clamping
- [x] **[NEW]** `apps/mobile/src/components/onboarding/OnboardingLayout.tsx` — 4-step wizard with step dots, Back/Next/Seal nav bar

### 3.3 — Navigation
- [x] **[NEW]** `apps/mobile/src/screens/OnboardingScreen.tsx` — thin wrapper: OnboardingLayout → saveUserConfig → navigate
- [x] **[MODIFY]** `apps/mobile/src/navigation/AppNavigator.tsx` — conditional initial route (`getUserConfig()` → null = Onboarding, else Auth)

### 3.4 — Tests
- [x] **[NEW]** `apps/mobile/__tests__/UserConfig.test.ts` — 21 tests (clampValue, constants, defaults, todayUTC)
- [x] **[NEW]** `apps/mobile/__tests__/StepNumberPicker.test.ts` — 16 tests (period/cycle clamping boundaries)
- [x] **[NEW]** `apps/mobile/vitest.config.ts` — test runner config
- [x] `apps/mobile/package.json` — added `"test": "vitest run"`

### 3.5 — Ledger Integration & Prediction Engine
- [x] **[NEW]** `apps/mobile/src/utils/PredictionEngine.ts` — Pure functions for calculating cycle predictions, avoiding external date lib dependencies.
- [x] **[NEW]** `apps/mobile/__tests__/PredictionEngine.test.ts` — Unit tests for leap years, month boundaries, short cycles. 
- [x] **[MODIFY]** `apps/mobile/src/screens/LedgerScreen.tsx`:
  - Dynamically calculates `futureData` using `PredictionEngine` and `UserConfig`.
  - Auto-fills manual logged periods using `config.periodLength` instead of hardcoded 7 days.
  - Initial Seeding: Automatically batch logs `lastPeriodDate` representing `config.periodLength` on very first entry matching an unseeded config flag.
  - Now imports `UserConfig` using the exported storage helpers.
- [x] **[MODIFY]** `apps/mobile/src/models/UserConfig.ts` — Adds `hasSeededInitialData` boolean.

### 3.6 — Canonical Serialization Bugfix
- [x] **[MODIFY]** `packages/shared/src/hashing.ts` — Fixed `canonicalStringify` to securely strip `undefined` keys and map `undefined` array items to `null` exactly like `JSON.stringify` to prevent `JSON.parse()` decryption failures downstream.
- [x] **[NEW]** `packages/shared/__tests__/hashing.test.ts` 
- [x] **[MODIFY]** `apps/mobile/src/screens/LedgerScreen.tsx` — Defense-in-depth: Seeder now entirely omits the `note` key instead of setting it to `undefined` when blank.

---

## Verification Proof

### Phase 3 Tests
```
 RUN  v4.0.18 /Users/kabst/.gemini/antigravity/locket-monorepo/apps/mobile

 ✓ __tests__/StepNumberPicker.test.ts (16 tests) 3ms
 ✓ __tests__/UserConfig.test.ts (21 tests) 5ms
 ✓ __tests__/PredictionEngine.test.ts (8 tests) 3ms

 Test Files  3 passed (3)
      Tests  45 passed (45)
   Duration  203ms
```

```
=== C3.2: Verifying clamping constants in source ===
10:export const PERIOD_MIN = 1;
11:export const PERIOD_MAX = 20;
12:export const CYCLE_MIN = 10;
13:export const CYCLE_MAX = 100;
=== PASS: All clamping constants found ===
```

### Phase 3.6 `@locket/shared` Canonical Serialization Bugfix
```
 RUN  v4.0.18 /Users/kabst/.gemini/antigravity/locket-monorepo/packages/shared

 ✓ __tests__/hashing.test.ts (7 tests) 3ms
   ✓ canonicalStringify (7)          
     ✓ handles primitive values correctly 1ms
     ✓ sorts object keys alphabetically 0ms
     ✓ handles nested objects recursively 0ms
     ✓ safely drops object keys with undefined values like JSON.stringify 1ms
     ✓ preserves object keys with null values 0ms
     ✓ maps undefined array items to null like JSON.stringify 0ms
     ✓ complex nested object with undefined preserves validity 0ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  176ms
```

### Crypto-Engine Determinism Validation (Post-fix Regression Check)
```
 RUN  v4.0.18 /Users/kabst/.gemini/antigravity/locket-monorepo/packages/crypto-engine

 ✓ tests/PRE.determinism.test.ts > PRE Determinism — Anchor Hash Consistency > deterministic: same data + same key → same anchorHash 13ms
 ✓ tests/PRE.determinism.test.ts > PRE Determinism — Anchor Hash Consistency > deterministic: key generation is unique each time 1ms
 ✓ tests/PRE.determinism.test.ts > PRE Determinism — Anchor Hash Consistency > deterministic: canonicalStringify produces consistent ordering 5ms
 ... 10 other tests ...

 Test Files  4 passed (4)
      Tests  13 passed (13)
   Duration  249ms
```

### Phase 3.5 Prediction Engine Tests
```
 RUN  v4.0.18 /Users/kabst/.gemini/antigravity/locket-monorepo/apps/mobile

 ✓ __tests__/PredictionEngine.test.ts (8 tests) 3ms
   ✓ PredictionEngine -> calculatePredictedPeriods (5)
     ✓ predicts standard boundaries correctly 1ms
     ✓ handles month wrapping correctly (end of month start) 0ms
     ✓ handles leap years correctly 0ms
     ✓ handles year boundary correctly 0ms
     ✓ handles short cycles with long periods without advancing month early 0ms
   ✓ PredictionEngine -> getLatestPeriodStart (3)
     ✓ returns config date when ledger is empty 0ms
     ✓ returns config date when ledger has no isStart flags 0ms
     ✓ finds the most recent isStart event based on timestamp 0ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Duration  130ms 
```

---

## Context for Next Agent

- **Key Files:**
  - [UserConfig.ts](file:///Users/kabst/.gemini/antigravity/locket-monorepo/apps/mobile/src/models/UserConfig.ts) — clamping logic + interface
  - [StorageService.js](file:///Users/kabst/.gemini/antigravity/locket-monorepo/apps/mobile/src/services/StorageService.js) — `saveUserConfig()` / `getUserConfig()`
  - [AppNavigator.tsx](file:///Users/kabst/.gemini/antigravity/locket-monorepo/apps/mobile/src/navigation/AppNavigator.tsx) — conditional routing
  - [OnboardingLayout.tsx](file:///Users/kabst/.gemini/antigravity/locket-monorepo/apps/mobile/src/components/onboarding/OnboardingLayout.tsx) — wizard orchestrator
- **Caveats:**
  - No React Native component rendering tests (would require `jest-expo` + RNTR). Pure-logic tests cover all critical clamping/persistence requirements.
  - `StepLastPeriod` uses a custom FlatList (no external calendar dependency). If a richer date picker is needed later, `react-native-calendars` can drop in.
  - UserConfig stored in `expo-secure-store` (not AsyncStorage) for health data security.

## Dependencies Unlocked

- **Phase 6** (Mobile Sync + QR) — can read `UserConfig` to determine if onboarding is complete
- **Phase 9** (Sovereign Persistence / Cloud Backup) — can back up `UserConfig` alongside encrypted ledger data
