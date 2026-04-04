# TODOS — Deferred from /autoplan (claude/busy-euler)

Generated: 2026-04-02 | Plan: Euki Education Layer

---

## Deferred from CEO Review

- [ ] **GPL legal opinion** — Before closing source, get legal opinion on whether bundled `menstruation.ts` compiled into app binary triggers GPL v3.0 "part of the program" coverage. Low urgency for open-source Locket; high urgency if monetizing/closing source.
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

## Deferred from Eng Review

- [ ] **Date key format normalization (full codebase)** — `calculatePredictedPeriods` writes 0-indexed no-pad keys; `getLatestPeriodStart` writes 1-indexed ISO. This PR fixes `getLatestPeriodStart` to use UTC methods, but does not normalize the key format across the whole codebase. Full normalization is a larger refactor that should be its own PR.
- [ ] **ContentSheet Android portal implementation** — If Taste Decision #2 resolves to "use Portal": implement `react-native-portal` or equivalent to avoid nested RN Modal misbehavior on Android. If the simple nested Modal approach ships first, file a follow-up to test on Android before GA.
- [ ] **`packages/content/` package extraction** — If Taste Decision #3 resolves to "extract from shared": create `packages/content/` and move `packages/shared/src/euki/` there. Update imports in `useEukiContent.ts`.
- [ ] **Euki content 6-month review cadence** — Product commitment: check `Euki-Inc/Euki-iOS` for content file changes every 6 months or on new Euki release. Add to product calendar.
- [ ] **Note field: cap existing entries** — This PR caps new entries at 2000 chars in DataEntryModal. Existing uncapped entries are unaffected (encrypted at rest). No migration needed.
