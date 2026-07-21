# TODOS — Deferred from /autoplan (claude/busy-euler)

Generated: 2026-04-02 | Plan: Euki Education Layer

---

## Deferred from CEO Review

- [x] **GPL legal opinion** — Closed 2026-07-19: mooted by commit 634c72c, which replaced all 17 Euki-derived items in `menstruation.ts` with original copy (no GPL-derived text remains in the bundle); Euki header, links, ContentSheet attribution, and root NOTICE removed. Copy pending clinical review before release.
- [ ] **Push notifications (APNs/FCM)** — Too large for this PR; separate initiative.
- [ ] **Cycle data visualization in provider portal** — P7 scope.
- [ ] **Import migration from Flo/Clue** — Separate initiative.
- [ ] **Contraception/STI/pregnancy content** — Not in Euki cycle-core MVP scope.
- [ ] **Multi-language support** — Euki has ES; future work.
- [ ] **Full-text search across content** — Requires dedicated tab; contradicts no-tab constraint.
- [ ] **Bookmarking content items** — Future feature.

## Deferred from Design Review

- [ ] **Accessibility** — Keyboard nav, contrast ratios, touch targets for new DataEntryModal fields not specified. Required before production.
- [ ] **Dark mode** — Phase colors, ContentSheet, DisclaimerModal, PhaseInsightCard dark-mode variants not specified.
- [ ] **PhaseInsightCard dismiss state** — Dismissed state persisted in AsyncStorage `phase_insight_dismissed`. If user dismisses, card stays hidden. Add "re-show" affordance in Settings.

## Deferred from Eng Review (CycleTrends — 2026-04-23)

- [x] **CycleTrendsScreen — React Native implementation** — Completed by PR #14 (Cycle Trends tab in `CycleInsightsScreen`); struck per qol-uiux plan 2026-07-07.
- [x] **CycleTrends phase-calculation wiring** — Completed by PR #14 (`utils/cycleHistory.ts`, consolidated into `utils/phaseBoundaries.ts` by the qol-uiux pass); struck per qol-uiux plan 2026-07-07.

## Deferred from Design/Eng Review (qol-uiux — 2026-07-07)

- [ ] **BBT charting on Cycle Trends** — Temperature is now logged (qol-uiux T4) with no read surface; decide chart vs list within 1–2 releases or logging feels pointless. Blocked by: T4 (shipped).
- [ ] **Calendar "jump to year" index** — If 20-year import users appear, the Today pill alone may not be enough wayfinding in the data-derived calendar range.

## Deferred from Eng Review

- [ ] **Date key format normalization (full codebase)** — `calculatePredictedPeriods` writes 0-indexed no-pad keys; `getLatestPeriodStart` writes 1-indexed ISO. This PR fixes `getLatestPeriodStart` to use UTC methods, but does not normalize the key format across the whole codebase. Full normalization is a larger refactor that should be its own PR. Update 2026-07-19: `FhirService` now fail-closes its boundary — non-ISO ledger keys throw instead of being interpolated into `effectiveDateTime`; the future share-payload builder must convert day-map keys to ISO on the mobile side.
- [ ] **ContentSheet Android portal implementation** — If Taste Decision #2 resolves to "use Portal": implement `react-native-portal` or equivalent to avoid nested RN Modal misbehavior on Android. If the simple nested Modal approach ships first, file a follow-up to test on Android before GA.
- [ ] **`packages/content/` package extraction** — If Taste Decision #3 resolves to "extract from shared": create `packages/content/` and move `packages/shared/src/euki/` there. Update imports in `useEukiContent.ts`.
- [ ] **Euki content 6-month review cadence** — Product commitment: check `Euki-Inc/Euki-iOS` for content file changes every 6 months or on new Euki release. Add to product calendar.
- [ ] **Note field: cap existing entries** — This PR caps new entries at 2000 chars in DataEntryModal. Existing uncapped entries are unaffected (encrypted at rest). No migration needed.

## Deferred from Design Review (design-system-adoption — 2026-07-07)

- [ ] **P2: Theme Onboarding/Consent/Import/LedgerInitError screens for dark mode** — These screens still use light-only static colors and were not converted to `useTheme()`/`t.*` tokens in the design-system-adoption pass. Deferred from `/design-review` 2026-07-07.
- [ ] **P3: Remove dead components `DataEntryModal.tsx` and `LogDataScreen.tsx`** — Not referenced by `AppNavigator`. Confirm unreferenced before removal. Deferred from `/design-review` 2026-07-07.

## Deferred from /autoplan review — MVP License Separation + Clinician Sharing Wedge (2026-07-18)

- [ ] **E6 delight pack for sharing** — Date-range presets ("last 3 cycles"), viewer print stylesheet, QR expiry countdown polish, share-sheet PDF export. Each ~30min CC. Deferred: outside ship-gating core; land after the observation visit shapes the viewer. (P3)
- [ ] **E7 generic encrypted-handoff infra** — Generalize blob+fragment-key share into reusable infrastructure (partner sharing, exports). Deferred: platform bet before one observed clinician; revisit post-observation. (P3, M effort → CC ~2h)
- [ ] **Blob-service runbook** — One page: "link didn't work in the exam room" triage (expired? store restarted? clock skew?). Write alongside the blob service. (P3, S)
- [ ] **SHLink full compliance (Approach C)** — shlink: URI, manifest, JWE, PIN for async links; convergence target once the standard earns it and the clinician side is observed. Depends on: H1 format decision in OQ1. (P3, L → CC ~3-5d)

## Deferred from /qa (fix/mvp-gpl-license-exposure — 2026-07-19)

- [ ] **Landing page still markets Umbral PRE as a current feature** — `apps/web/index.html` presents deferred-PRE capabilities in 5+ places: meta description ("proxy re-encryption"), the "UMBRAL PRE / Cryptographic Sharing" pillar card, "The Portal View" feature card, the "UMBRAL PRE" spec item, and a blog card. PRE is deferred post-MVP (see `docs/umbral-pre-mvp-deferral-2026-07-19.md`) and `apps/web` IS in MVP release scope, so the marketing site promises a capability the MVP doesn't ship. Copy direction is a product decision (reframe to the QR one-shot share story, soften to roadmap framing, or remove) — needs a human call before App Store/launch. Severity: medium (content accuracy). Found by /qa 2026-07-19.
- [ ] **Landing page footer/CTA placeholder links** — "Security Paper", "About", "Press", "Contact", "View all posts", "Inscribe Your First Page" all point to `#`. Fine for pre-launch, dead ends at launch. Severity: low. Found by /qa 2026-07-19.

## Deferred — Umbral PRE post-MVP (2026-07-19)

- [ ] **Resume Umbral PRE / consent sharing post-MVP** — Feature deferred, not deleted: `packages/crypto-engine`, gateway PRE routes, and both portal apps remain in the workspace. Decision record: `docs/umbral-pre-mvp-deferral-2026-07-19.md`. **Do NOT resurrect `SyncService.uploadBaselineCiphertext` as-is** — it PRE-encrypted and uploaded baseline data, violating architecture Invariant #7 (baseline must never be shareable), independent of licensing. Mobile PRE code is recoverable from git history; the iOS WASM/Hermes blocker (see locket-mobile-pre-campaign) still gates any mobile bring-up.
