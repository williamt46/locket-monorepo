# QoL UI/UX Plan — Calendar depth, Log safety, Trends, Insights, Onboarding

Reviewed by /plan-design-review on 2026-07-07 (pre-PR-#14 `main`). Design completeness: 4/10 → 8/10.
**Revised 2026-07-07 against post-PR-#14 `main`** (design-system adoption, merge `8d8e1fe`): PR #14 shipped a virtualized vertical calendar, the Insights/Cycle Trends tabbed screen with an interactive OrbitGauge, `cycleHistory.ts` phase segmentation (+tests), dark-mode theming (`ThemeContext`), and the kit's `Start | →` pill design on LogScreen. Scope below is re-baselined to the gaps that remain.

## Scope map (plan name → what exists NOW)

| Plan name | Reality post-PR #14 | Scope class |
|---|---|---|
| VerticalCalendar | `apps/mobile/src/components/VerticalCalendar.tsx` — **already** a month-item FlatList with `getItemLayout`, `initialScrollIndex`, Today pill in LedgerScreen header. Fixed window: −24/+3 months. `VerticalYearView` + `HorizontalCalendar` deleted | Range derivation + memoization only |
| LogScreen | `apps/mobile/src/screens/LogScreen.tsx` — kit's `Start \| →` / `← \| End` luteal pills shipped; inline symptom accordions (AddSymptomsScreen retired); ✕ still silently discards; no temperature field | 3 additive changes |
| InsightsScreen | **Shipped**: `CycleInsightsScreen.tsx` with TabBar (Insights / Cycle Trends), interactive `OrbitGauge.tsx` (drag/tap preview drives PhaseInsightCard), phase legend, DayStrip (−1..+3 window) | Gap-closing enhancements |
| CycleTrendsScreen | **Shipped** as the Cycle Trends tab: stat cards, PhaseBar history (capped at 6), `utils/cycleHistory.ts` + tests. Both deferred TODOs (RN implementation, phase-calc wiring) are **done** | Filters, expand, copy polish |
| Onboarding | `OnboardingLayout.tsx` 4-step wizard; baseline mandatory; LedgerScreen seeds from it (~`LedgerScreen.tsx:211`) | Flow change with data implications |

---

## 1. VerticalCalendar — history depth without jank

Virtualization is **done** (FlatList, fixed `ITEM_HEIGHT`, `getItemLayout`, `initialScrollIndex`, `scrollToToday`, Today pill). Remaining work:

**Range** *(revised per eng review — the original `min(earliest, −120 mo)` formula guaranteed every user a blank decade of scroll, and `+12 mo` forward is dead space against usePredictions' 3-cycle horizon)*: `startMonth = min(earliestLoggedMonth, today − 24 months)` — the 24-month floor is the default; older data (imports) extends the range to its earliest month, up to 20 years. `endMonth = month of the last predicted period + 1` (derived from `futureData`, currently ≈ today + 3). No fixed −120/+12 constants.

**Memoization (required when imports stretch the list).** `VerticalCalendar` currently passes the whole `data` map to every `MonthGrid` with `extraData={data}`, and creates a fresh inline `onToggle` arrow per render (`VerticalCalendar.tsx:93`), which defeats `React.memo`:
- `React.memo(MonthGrid)` with per-month-slice props so off-screen months never re-render; pre-bucket **both** `decryptedData` and `futureData` by month key once per data change.
- Stable toggle callback: pass `onToggleDate` + month coords into the memoized `MonthGrid` (or `useCallback` keyed on item identity) — an inline arrow prop makes every month re-render regardless of bucketing.
- Decryption already happens once in LedgerScreen — keep it that way; the list consumes derived per-month buckets only.
- **Wayfinding at 240 rows:** Today pill already exists (always-visible header pill) — keep it; optionally hide when the current month is on screen.

**States:** months with no data render the plain grid (no empty-state card — absence of marks IS the state); prediction months show watermark dots per existing `futureData` styling; range boundary is simply the end of the list.

## 2. LogScreen

**2a. SaveReminder modal (data-loss fix).** Today ✕ (`navigation.goBack()` in the header, ~`LogScreen.tsx:301`) silently discards. Add dirty-check: compare current `{isStart, isEnd, bleeding, clots, symptoms, note, temperature}` against `initialData`-derived snapshot. Implement as a single `snapshotFields()` function used for both the initial and current snapshot, so T4's temperature field extends one list instead of two drifting copies (LogScreen state is spread across 7 `useState` hooks). On ✕ with dirty state, show modal (reuse `PeriodConfirmModal` visual pattern: card 16px radius, title, body, stacked actions; theme via `t.*` tokens):
- Title: "Save your changes?" Body: "You've logged data for {date} that isn't saved yet."
- Actions: **Save** (primary, Locket Blue fill — runs `handleSave`), **Discard** (text button, destructive red like Clear Data), **Keep editing** (cancel).
- Clean state → ✕ closes immediately, no modal. Never nag on untouched screens.
- **Guard all three exit paths:** implement via a `navigation.addListener('beforeRemove', …)` intercept, not an ✕-specific handler — Android hardware back and iOS swipe-back hit the same silent `goBack()` and must trigger the identical modal (`e.preventDefault()` when dirty).

**2b. Period Start / End selected-state visibility.** *(Reframed: PR #14 shipped the kit's `Start | →` / `← | End` pill pair — the opposite of what the pre-merge plan assumed.)* Both pills render as filled luteal purple at all times; selected differs from unselected only by opacity (1 vs 0.92) — indistinguishable at a glance. Fix within the shipped design: unselected pills drop to luteal-tint fill with luteal text (or outline style); selected keeps solid luteal fill + white text and gains a leading ✓ glyph. Selection toggles fire `Haptics.selectionAsync()`. Update `accessibilityState={{ selected }}` alongside the existing labels. No kit sync needed — kit and production now match.

**2c. Temperature (BBT).** New section between BLEEDING and the symptom accordions, header `TEMPERATURE` (existing `sectionHeader` style, Locket Blue):
- Collapsed: a single "+ Add temperature" text button (phase color, same style as the accordion "+ Add" links).
- Expanded: decimal field with stepper (±0.1) + unit toggle pill pair `°F | °C` (999px pills, selected = phase tint fill).
- Range clamp: 92.0–105.0 °F / 33.3–40.6 °C. Out-of-range input clamps on blur with a one-line helper: "Between 92–105 °F". Default seed on first expand: 98.6 °F / 37.0 °C.
- Storage: extend `LogEntry` with `temperature?: { value: number; unit: 'F' | 'C' }` — store **as entered**, never convert at write (lossless; encrypted payload like every other field). Display converts to the user's active unit. Unit preference persists (last-used unit wins) — note `UserConfig` is now a deprecated re-export of `BaselineCycleData`; unit pref is display preference, not health data, so store it alongside theme preference, not in the baseline.
- Clearing: an ✕ affordance on the expanded row returns to collapsed state and writes `temperature: null` (explicit-clear, matching the day-merge semantics in `handleSave`).
- **Merge semantics (eng review):** temperature state seeds from `initialData.temperature` on mount and is **always** included in the `dayData` write (`temperature: value ?? null`), like note/bleeding/symptoms. Seeding is what makes this safe — an untouched save writes back the same value (last-write-wins holds); omitting the field instead would let LedgerScreen's per-day merge resurrect a cleared temp from older events, and writing un-seeded null would erase a prior temp on every ordinary save.
- **Known limitations (documented, not built):** existing users' already-imported BBT stays baked into note text as `"BBT: 36.5"` — no retroactive note-parsing migration (risky string surgery); re-importing the same file after the fix will duplicate the value (note string + temperature field). Imported values outside the 92–105 °F clamp display as stored — the clamp applies to manual entry only.
- **Import wiring (bug fix, not new scope):** `ImportService.ts`'s `ledgerEntryToLogEntry` (~line 510–523) already parses BBT from Clue/Flo/CSV into `entry.bbt`, but its own comment admits there's no dedicated field yet — it stuffs the value into the free-text `note` as `"BBT: 36.5"`. Once `LogEntry.temperature` exists, that mapping must write `log.temperature` directly instead of appending to notes. Source formats never tag which unit `bbt` was recorded in; since valid BBT ranges in °F (92–105) and °C (33.3–40.6) don't overlap, infer unit by magnitude (`bbt >= 50 → 'F'`, else `'C'`) rather than assuming a fixed source convention. `MonthGrid.tsx`'s "has data" checks (lines ~47–48) test a `dayData.bbt` field no `LogEntry` has ever set (dead condition) — swap to `dayData.temperature` so imported temperature-only days keep their calendar indicator.

## 3. Insights + Cycle Trends — close the gaps in the shipped screen

`CycleInsightsScreen` shipped in PR #14 with tabs, interactive OrbitGauge (drag/tap ring preview, center tap snaps to today, preview drives PhaseInsightCard), legend, day strip, stat cards, and PhaseBar cycle history backed by `buildCycleHistory` (tested). Remaining work only:

### Insights tab
- **Gauge center date line:** add **`{Mon} {DD}`** of the previewed/selected day under the DAY line (13px, fog) — e.g. "DAY 14 / Jul 7".
- **Learning state — precise trigger (eng review, reconciled with §4):** ring renders `t.paleLavender` + "Learning your cycle" when there is **no logged period start AND (no baseline OR `lastPeriodDate` is missing/estimated)**. "No baseline" alone is wrong once §4 ships — an "I'm not sure" run produces a baseline with 28/5 values, and the current `baseline?.cycleLength ?? 28` fallback makes estimated and real indistinguishable. `estimatedFields` travels with the baseline through E1's hook (route params go away) so the gauge/strip can render estimate treatment.
- **Overdue cycles (eng review — undefined before, three features build on it):** when a period is late, `dayInCycle` exceeds `cycleLength`. Define: gauge marker pins at cycle end with center "DAY {n} · {k} days late"; the day strip extends day 1 → `max(predicted end, today)` so today stays present and centerable; the consolidated phase util (E2) **clamps to luteal** past cycle end instead of `phaseForDay`'s current modulo wrap (`OrbitGauge.tsx:33`), which would label day 30 of a 28-day cycle "menstrual".
- **Today marker:** today's position keeps a hollow ring marker while previewing another day (verify against shipped marker behavior; add if missing).
- **Reduce Motion:** marker/preview transitions become instant under `AccessibilityInfo.isReduceMotionEnabled`.
- **Accessibility:** gauge as a single adjustable element, label "Cycle day {n} of {len}, {phase} phase, {date}"; swipe up/down moves the preview day.
- **Day strip upgrade:** replace the fixed −1..+3 window with a horizontal `FlatList`, one cell per day of the **current cycle** (day 1 → predicted cycle end). 44×56 pt cells (dow 11px caps, day number 16px), selected cell = phase-color filled circle, today = ring outline, predicted future days at 50% opacity. Initial scroll centers today. Strip selection and gauge preview share one selection state.
- **Log CTA:** below the strip, anchored to the selected day: a **"Log {Mon} {DD}"** button (12px-radius, phase color fill) navigating to `Log` with that date and the same params LedgerScreen passes (`existingPeriodDays`, `periodLength`, `keyHex`). Future predicted days: disabled past today (can't log the future) — selected future day shows phase info only.
- **Data flow (eng-review blocker):** CycleInsightsScreen receives `decryptedDays` as a by-value snapshot in `route.params` (`LedgerScreen.tsx:313`). The Log CTA creates an Insights → Log → back loop where the snapshot is stale after save — gauge/strip/trends silently show old data. Fix first: extract a `useDecryptedLedger(keyHex)` hook (decrypt-once logic lifted from LedgerScreen) consumed by both screens; Insights stops receiving `decryptedDays`/`baseline` via params. Also extract a `buildLogNavParams(decryptedData, config, date)` helper so the `existingPeriodDays` mapping (`LedgerScreen.tsx:254`) isn't duplicated.
- **Phase-boundary consolidation (pre-req for gauge/strip work):** the 0.45/0.55 follicular/ovulatory boundaries are triplicated — `PredictionEngine.ts:111`, `cycleHistory.ts:49`, `OrbitGauge.tsx:35+88`. Consolidate into one exported util before building more on top; the three copies can drift and disagree about which phase a day is in.

### Cycle Trends tab
Shipped: two stat cards with basis sub-lines, CYCLE HISTORY header, PhaseBar rows (current cycle includes `paleLavender` future segment), empty-state card. Remaining:

- **Filter:** pill row `All · 3 mo · 6 mo · 1 yr · Since…` (999px pills, selected = Locket Blue fill, white text). Default **All**. `Since…` opens a month/year wheel picker bounded [earliest logged month, current month]; active state renders the pill as "Since Mar 2024" with an ✕ to clear back to All. Averages and the history list both respect the filter. Filter resets to All on screen exit (no hidden persistent filter state).
- **Basis sub-lines:** tighten to "{N} cycles · since {Mon YYYY}" (shipped copy is close; add the since-date).
- **Insufficient data in window (<2 period starts):** cards show "—" with "Not enough cycles in this range. Try a wider filter." (warm, actionable).
- **Expand:** raise the hard `slice(0, 6)` cap to **7** most-recent, then "View all ({N})" text button expanding inline to the past **24** cycles (lazy-rendered; collapse control at the bottom). Phase boundaries come from the shipped `segmentCycle` — no new calculation work. Cycles predating reliable phase data render two-segment bars (period + rest) rather than invented phases.

## 4. Onboarding — "I'm not sure" per step

Each input step (Last period, Period length, Cycle length) gets a tertiary **"I'm not sure"** text button (graphite, 16px, 48pt target) under the picker, in addition to Next:
- Period length unknown → default **5 days**; Cycle length unknown → default **28 days** (clinical medians). `BaselineCycleData` gains `estimatedFields: ('lastPeriodDate'|'periodLength'|'cycleLength')[]`.
- Last period unknown → **no ledger seeding** (skip the LedgerScreen seed block ~line 211), predictions stay dormant; Insights gauge shows the "Learning your cycle" state (§3) until the first Period Start is logged, which becomes the anchor.
- Step content marks the choice: picker dims and an "Using a typical value — you can change this in Settings" caption appears (the `BaselineConfigSheet` editor already lives in Settings per PR #14).
- Final step CTA stays "Seal Ledger" even with estimates — the ritual is the brand moment; a sub-caption "Estimates are fine — Locket learns as you log" reduces first-run anxiety.
- Prediction confidence: while any `estimatedFields` remain, prediction-derived UI (future dots, gauge future arc) uses the existing watermark/50% treatment and Insights copy says "estimate".
- Note: onboarding screens are still light-only (deferred dark-mode TODO from the PR #14 design review) — new onboarding UI should use `useTheme()` tokens so it doesn't deepen that debt.

## 5. Interaction state table

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Calendar 20-yr scroll | Windowed render; no spinner (data already decrypted) | Plain month grid | — | Marks render | Prediction months watermark |
| SaveReminder | — | Clean state → no modal | Save fails → existing Alert, stay on screen | Saves + goBack | Discard keeps ledger untouched |
| Temperature | — | Collapsed "+ Add temperature" | Out-of-range clamps + helper line | Chip shows "98.6 °F" on re-open | Cleared → explicit null write |
| Trends filter | Instant (in-memory events) | <2 starts: "Not enough cycles in this range. Try a wider filter." | Invalid Since month impossible (bounded picker) | Stats + basis sub-line | Filter narrows list + stats together |
| Phase bars ×24 | Lazy render on expand | <7 cycles: show what exists, no expander under 8 | — | 7 shown, expander labeled with real count | Pre-phase-data cycles: 2-segment bars |
| Orbit gauge | — | No baseline: "Learning your cycle" ring | — | Preview transitions honor Reduce Motion | Future selected day: info only, Log disabled |
| Onboarding unsure | — | — | — | Caption confirms typical value used | Mixed known/estimated fields tracked per-field |

## 6. Design-system alignment

- Tokens throughout: use `useTheme()` / `t.*` tokens (shipped in PR #14) — never raw hex. Cards 16px, buttons 12px "Safe-Touch", pills 999px, section headers 13px/700/caps, `font()` typography helper.
- New vocabulary entries: `DayStrip` (full-cycle FlatList version), `TemperatureField`, `SaveReminderModal`, `FilterPills`. `OrbitGauge` and `PhaseBar` already exist in RN — extend, don't fork.
- ~~Kit sync debt~~ **Resolved by PR #14**: production now implements the kit's `Start | →` pill design; kit and shipped screen match. (§2b changes the *selected-state treatment* within that design — if adopted, mirror it back to the kit in the same PR.)

## 7. Responsive & accessibility

- Touch targets ≥44 pt: day-strip cells, filter pills, temperature stepper, "I'm not sure", modal actions.
- VoiceOver: gauge = adjustable (label in §3); day strip cells "Tuesday July 7, cycle day 14, ovulatory, selected"; temperature announces value + unit; SaveReminder traps focus; period pills expose `accessibilityState.selected`.
- Dynamic Type: stat numbers and gauge center scale to XL without truncation (`adjustsFontSizeToFit` on the DAY line).
- Contrast: phase colors used as fills carry white text only ≥17 pt bold (PhaseBar labels); body text stays ink-on-paper ≥4.5:1.
- Reduce Motion: gauge preview transitions and strip auto-centering become instant.
- **Dark mode:** *(updated — no longer deferred)* `ThemeContext` + dark tokens shipped in PR #14. All new components in this plan consume `t.*` tokens from day one and must be verified in both appearances. Only the onboarding screens' theming remains on the deferred TODO.

## What already exists (reuse, don't reinvent)

- Shipped in PR #14: `VerticalCalendar` (virtualized), `OrbitGauge` (interactive), `CycleInsightsScreen` tabs + PhaseBar + stat cards, `cycleHistory.ts` (+tests), `DesignSystem.tsx` primitives (Card, TabBar, NavPill, SectionHeader), `ThemeContext`/dark tokens, `BaselineConfigSheet` Settings editor, inline symptom accordions.
- Pre-existing: `PeriodConfirmModal` (modal pattern), phase color/tint plumbing, `PhaseInsightCard`, `usePredictions`, `MonthGrid`.
- The two deferred TODOs this plan originally absorbed (CycleTrends RN implementation, phase-calc wiring) were **completed by PR #14** — strike them from TODOS.md when this ships.

## NOT in scope

- Temperature charting/visualization on Trends or calendar — logging only this pass; charting is its own feature (open decision below).
- Push reminders to log temperature — separate initiative (APNs/FCM already deferred).
- Import-migration UX from Flo/Clue — separate initiative; calendar range work merely *supports* imported depth.
- Onboarding/Consent/Import screen dark-mode conversion — stays on the existing deferred TODO (but §4's new UI is token-based).
- Web app parity — mobile only.

## Implementation Tasks

Re-baselined post-PR #14; E-tasks added by /plan-eng-review 2026-07-07. Checkbox as you ship.

- [x] **E1 (P1, human: ~4h / CC: ~15min)** — Data flow — extract `useDecryptedLedger(keyHex)` hook; CycleInsightsScreen consumes live decrypted data instead of the `route.params` snapshot; extract `buildLogNavParams` helper. **Blocks T5.**
  - Surfaced by: Eng review Architecture #1 — `LedgerScreen.tsx:313` passes `decryptedDays` by value; Insights → Log → back shows stale data silently
  - Files: new `hooks/useDecryptedLedger.ts`, `screens/LedgerScreen.tsx`, `screens/CycleInsightsScreen.tsx`
  - Verify: log a period day from Insights' Log CTA, go back — gauge/strip/trends reflect it without re-entering the screen
- [x] **E2 (P2, human: ~2h / CC: ~10min)** — Phase boundaries — consolidate the 0.45/0.55 constants into one exported util consumed by `PredictionEngine`, `cycleHistory`, `OrbitGauge`. **Do before T5/T6.**
  - Surfaced by: Eng review Architecture #3 — boundary math triplicated, can drift
  - Files: `utils/PredictionEngine.ts`, `utils/cycleHistory.ts`, `components/OrbitGauge.tsx`
  - Verify: existing `cycleHistory.test.ts` passes; add a boundary-equivalence test across all three call sites
- [x] **E3 (P1, human: ~1d / CC: ~30min)** — Tests (vitest) — unit tests for every new pure function: T1 range derivation, T2 `isDirty`, T4 clamp + magnitude unit inference + **CRITICAL regression test** that imported `bbt` lands in `temperature` and is no longer appended to `note` (behavior change to `ledgerEntryToLogEntry`), T6 `buildCycleHistory` date-window param, T7 seed-guard/estimatedFields.
  - Surfaced by: Eng review Test coverage diagram — 0/9 new code paths covered by the plan as written; regression rule mandates the import-mapping test
  - Files: `__tests__/utils/`, `__tests__/services/`, extend `__tests__/utils/cycleHistory.test.ts`
  - Verify: `npm test` green; each new util has edge-case coverage (★★★), not smoke tests

- [x] **T1 (P1, human: ~4h / CC: ~15min)** — VerticalCalendar — data-derived range (earliest logged month with a −24 mo floor → last predicted month + 1) replacing the fixed constants; `React.memo(MonthGrid)` + per-month bucketing of `decryptedData` **and** `futureData` + stable toggle callback
  - Was: full virtualization rework. PR #14 shipped the FlatList/getItemLayout/Today-pill core. Range formula revised by eng review (outside voice) — old spec forced a blank decade for all users and 9 dead future months.
  - Files: `apps/mobile/src/components/VerticalCalendar.tsx`, `MonthGrid.tsx`, `screens/LedgerScreen.tsx`
  - Verify: fresh user sees ~28-month list; import 20 yrs → range extends to earliest month, scroll at 60fps, opens at current month; toggling one day re-renders only the affected month items (inline-arrow prop removed)
- [x] **T2 (P1, human: ~4h / CC: ~15min)** — LogScreen — dirty-check + SaveReminder modal (Save/Discard/Keep editing), themed via `t.*`
  - Files: `screens/LogScreen.tsx`, new `components/SaveReminderModal.tsx`
  - Verify: dirty ✕ AND Android back AND iOS swipe-back all prompt (`beforeRemove`); clean exits don't; Save path == footer save; both appearances
- [x] **T3 (P2, human: ~3h / CC: ~10min)** — LogScreen — distinct selected state for the `Start | →` pills (tint/outline unselected vs solid+✓ selected; opacity-only delta today), selection haptic, `accessibilityState.selected`
  - Reframed: PR #14 shipped the kit pill design; the visibility gap moved into RN.
  - Files: `screens/LogScreen.tsx`; mirror treatment to `docs/locket-design-system/project/ui_kits/mobile_app/LogScreen.jsx`
  - Verify: VoiceOver announces selected state; visual check both appearances
- [x] **T4 (P1, human: ~1.5d / CC: ~40min)** — LogScreen + model + import — TemperatureField (°F/°C toggle, 92–105 °F clamp, store-as-entered), explicit-clear semantics, fix `ImportService.ledgerEntryToLogEntry` to map imported BBT into `temperature` (magnitude-based unit inference) instead of the free-text note, swap `MonthGrid` dead `bbt` checks to `temperature`
  - Files: `models/LogEntry.ts`, `screens/LogScreen.tsx`, `services/ImportService.ts` (~line 510), `components/MonthGrid.tsx` (~lines 47–48), display-preference storage for unit pref (not `BaselineCycleData`)
  - Verify: round-trip encrypt/decrypt; clamp on blur; unit persists across sessions; import a CSV/Clue/Flo file with BBT and confirm it opens in the Temperature section, not appended to Notes; calendar dot still shows for temperature-only imported days
- [x] **T5 (P1, human: ~1.5d / CC: ~30min)** — CycleInsightsScreen Insights tab — gauge date line + learning state + Reduce Motion + adjustable-element a11y; DayStrip → full-current-cycle FlatList sharing selection with the gauge; "Log {date}" CTA with LedgerScreen-equivalent params
  - Was: full screen build. PR #14 shipped the gauge, tabs, and −1..+3 strip.
  - Files: `screens/CycleInsightsScreen.tsx`, `components/OrbitGauge.tsx`, new `components/DayStrip.tsx` (extract from screen)
  - Verify: strip selection drives gauge and vice versa; future days disable Log; no-baseline shows learning ring; Reduce Motion honored
- [x] **T6 (P1, human: ~1.5d / CC: ~30min)** — Cycle Trends tab — FilterPills (All/3mo/6mo/1yr/Since + bounded month picker), filtered stats + basis sub-line with since-date, <2-cycles guidance copy, PhaseBar ×7 with inline expand to 24
  - Was: included phase-calc wiring — shipped as `cycleHistory.ts`; `buildCycleHistory` may need a date-window parameter.
  - Files: `screens/CycleInsightsScreen.tsx`, new `components/FilterPills.tsx`, extract inline `PhaseBar` to `components/PhaseBar.tsx` (it grows with expand-to-24), `utils/cycleHistory.ts`
  - Verify: filter changes stats+list together; <2 cycles shows guidance; 24-cycle expand stays smooth
- [x] **T7 (P2, human: ~2d / CC: ~40min)** — Onboarding — "I'm not sure" per step, `estimatedFields`, no-seed path when last period unknown, estimate captions, token-based styling. *(Scope raised by eng review: making `lastPeriodDate` optional ripples through every consumer — the seed block crashes on `config.lastPeriodDate.split('-')` at `LedgerScreen.tsx:214`, plus `getLatestPeriodStart`, `buildCycleHistory`, `BaselineConfigSheet`, and the encrypted `locket_baseline_v2` payload — `estimatedFields` + optional `lastPeriodDate` need an additive schema rev with a read-side default for old payloads and backup/restore round-trip.)*
  - Files: `components/onboarding/*`, `models/BaselineCycleData.ts` (schema rev), `screens/LedgerScreen.tsx` (seed guard ~line 211), `hooks/usePredictions.ts`, `utils/cycleHistory.ts`, `components/BaselineConfigSheet.tsx`, backup/restore path
  - Verify: skip-all path reaches Ledger without crash; gauge shows learning state; first logged period anchors predictions; pre-T7 baseline payload still decrypts and renders
- ~~T8 — kit sync~~ **Dropped**: PR #14 brought production to the kit design; they match. (T3 carries the mirror-back if the selected-state treatment changes.)
- [x] **T9 (P2, human: ~4h / CC: ~20min)** — Migrate pre-existing imported BBT out of note text. One-time pass over existing `LogEntry`s: parse `note` for the `"BBT: {value}"` pattern written by the pre-T4 `ledgerEntryToLogEntry` (`ImportService.ts:519–522`), extract the value into `temperature` (same magnitude-based °F/°C inference as T4), and strip the substring from `note` (leave the rest of the note text intact). Re-import guard: since re-importing the same source file after T4 ships would otherwise duplicate the value (old note string + new `temperature` field), the migration must run **before** or **alongside** T4 ships, and the re-import path should skip writing to `note` if a `"BBT:"` match already exists in the day's current note (avoids re-duplicating on a second import of the same file post-migration).
  - Surfaced by: outside-voice review — pre-existing imports left in the lurch by a write-side-only fix; decision made 2026-07-07 to migrate rather than leave as documented debt
  - Files: new one-time migration script/util (run against decrypted `LogEntry`s, re-encrypt on write — same crypto path as any other edit), `services/ImportService.ts` (re-import dedup guard)
  - Verify: seed a pre-migration entry with `note: "period cramps. BBT: 36.5"`, run migration, confirm `temperature.value === 36.5` and `note === "period cramps."`; re-import the same source file post-migration and confirm no duplicate `BBT:` text reappears

## Proposed TODOS.md additions (design debt)

- **BBT charting on Cycle Trends** — temperature is being logged with no read surface; decide chart vs list within 1–2 releases or logging feels pointless. Blocked by: T4.
- **Calendar "jump to year" index** — if 20-year users appear, the Today pill alone may not be enough wayfinding.
- **Strike completed items** — "CycleTrendsScreen — RN implementation" and "CycleTrends phase-calculation wiring" were completed by PR #14.
- *(Removed from this list: dark-mode tokens for new components — no longer debt; ThemeContext shipped and new components are themed from day one. Also removed: imported-BBT note migration — decided 2026-07-07, built as T9, no longer deferred.)*

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 (Codex usage-limited until 2026-07-28; Claude subagent ran as outside voice) | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 (2026-07-07, post-PR-#14 re-baseline) | ISSUES_FOLDED | 6 review findings + 10 outside-voice findings; 3 new tasks (E1–E3); all folded into plan |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 (pre-PR-#14; plan re-baselined post-merge 2026-07-07) | ISSUES_OPEN | score: 4/10 → 8/10, 8 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**Eng review summary (2026-07-07):** Architecture 3 (stale route-params data flow → E1; dynamic-range recompute; phase-boundary triplication → E2) · Code quality 3 (nav-params duplication → E3-adjacent helper; dirty-snapshot single source; PhaseBar extraction) · Tests: 9 new pure-function paths had zero planned coverage → E3, incl. CRITICAL regression test for the `bbt`→`temperature` import behavior change · Performance 0 beyond T1.

**Outside voice (Claude subagent, Codex unavailable):** 10 findings; adopted — range formula inversion + dead future months (T1 revised), `beforeRemove` for back-gesture exits (T2), temperature seed/merge semantics (§2c), import-fix limitations documented + migration TODO, `lastPeriodDate`-optional ripple + baseline schema rev (T7 scope raised), learning-state trigger reconciled with §4, overdue-cycle behavior defined (§3). CROSS-MODEL TENSION: outside voice's range/forward-window findings overrode the pre-merge design-review defaults (−120/+12) — revert in §1 if you prefer the fixed window. Both reviewers agree on the stale-snapshot P1 (E1).

**Worktree parallelization:** Lane A: T1 (calendar). Lane B: T2 → T3 → T4 (LogScreen, sequential — same file). Lane C: E1 → E2 → T5 → T6 (Insights, sequential). Lane D: T7 (onboarding). Launch A–D in parallel; conflict flags: T4 and T1 both touch `MonthGrid.tsx`; E1 and T7 both touch `LedgerScreen.tsx` — merge those pairs carefully or sequence.

VERDICT: DESIGN + ENG REVIEWED — findings folded; ready to implement (E1/E2 before T5/T6; E3 alongside every task).

**Resolved 2026-07-07 (user decision):** T4 stays in the plan as scoped — the import-to-notes bug fix justifies shipping temperature logging ahead of a read surface; the "where it's read" question moves to TODOS.md as follow-up debt, not a blocker. Pre-existing imported BBT gets migrated out of note text — built as T9 above, no longer deferred.

NO UNRESOLVED DECISIONS
