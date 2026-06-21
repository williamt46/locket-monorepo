# Locket Design System
**Philosophy:** *Empathetic Intimacy* — warm, softly luminous, deeply private.

Locket is a privacy-preserving, sovereign health journal app at the intersection of cryptographic health data sharing and local-first architecture. The interface feels like "a warm lantern in a quiet room — focused, safe, and softly glowing."

---

## Sources

| Resource | Path / URL |
|---|---|
| Live mobile codebase (React Native / Expo) | `src/` (mounted read-only) |
| Existing UI kit HTML references | `ui-kit/` (mounted read-only) |
| Design system specification | `uploads/design.md` |
| Design system audit | `uploads/design_system_review_v2.html` |
| Color tokens | `src/theme/colors.ts` |
| Typography tokens | `src/theme/typography.ts` |
| Layout tokens | `src/theme/layout.ts` |

---

## Brand Vocabulary

Locket uses intentional terminology that should never be replaced with generic alternatives:

| Brand Term | Meaning |
|---|---|
| **Ledger** | The encrypted local data store / calendar screen |
| **Inscription** | A single log entry written to the Ledger |
| **Seal** | The cryptographic integrity indicator (animated ring + dot) |
| **Locket** | The app itself; also the metaphor for the lock/unlock biometric screen |

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Intimate and calm.** Copy speaks gently to a single person, never a crowd.
- **First-person singular** for user actions ("Your data", "Your cycle"), second-person for prompts ("Add a note…").
- **Non-clinical.** Health language is soft and accessible. Prefer "flow" over "discharge", "cramps" over "dysmenorrhea". Never diagnosing, always accompanying.
- **Affirmative security language.** Encryption is presented as warmth and protection, not fear. "Your intimate data is safe." not "Your data is encrypted with AES-256."
- **No emoji in UI copy.** Emoji appear only inside the native PhaseInsightCard (💧🌱☀️🌙) and as development scaffolding — never in production labels, headers, or buttons.
- **ALL CAPS for section headers only.** e.g. `BLEEDING`, `SYMPTOMS`, `CYCLE HISTORY`. Never sentence-case section headers.
- **Sentence case for everything else.** Buttons: "Save", "Period Start". Nav titles: "Cycle Insights", "Settings".
- **Short, precise.** No filler. "Export Encrypted Backup" not "Export your encrypted backup file to share or store".
- **Reassuring, not alarming.** Destructive actions use calm but clear language: "Clear Data", "Factory Reset", "This action cannot be undone."

### Examples from codebase
- "Unlock your Locket" (biometric prompt)
- "Tap anywhere to unlock"
- "Securing to decentralised storage..."
- "Your intimate data is safe."
- "Why does this happen? →"
- "Insights →" (nav link — always arrow, no period)

---

## VISUAL FOUNDATIONS

### Color System
The palette has three layers: **Foundation** (backgrounds/text), **Cycle** (living phase palette), and **Trust** (Locket Blue). Values reflect what the **live screens and CycleTrendsScreen.html** actually use — some differ from `design.md`.

| Token | Value | Role |
|---|---|---|
| `--paper` | `#FDFBF9` | Light page bg (Sun-Baked Sand) — *corrected from #FDFBF7* |
| `--ink` | `#1B1C1B` | Primary text / on-surface — *corrected from #1A1A1A* |
| `--fog` | `#717783` | Secondary text (MD3 outline) — *corrected from #8E8E93* |
| `--charcoal` | `#2D2D2D` | Legacy alias — prefer `--ink` |
| `--graphite` | `#4A4A4A` | Tertiary body text |
| `--watermark` | `#E6E2D8` | Subtle dividers |
| `--pale-lavender` | `#F2F2F7` | Input bg · predicted/future days in phase bar |
| `--card-white` | `#FFFFFF` | Card surface (light) |
| `--ink-blue` | `#004080` | Past/permanent data (calendar) |
| `--gold` | `#D4AF37` | Integrity Seal secure · Auth accent |
| `--alert` | `#C0392B` | Danger zone / destructive |
| `--locket-blue` | `#006EC7` | **Primary action** — buttons, active nav, links |
| `--locket-blue-tint` | `#E5F1FA` | Icon badge bg, positive tint |
| `--locket-navy` | `#1A2332` | Dark mark inner well · lockup-dark background · distinct from dark mode bg |
| `--md3-primary` | `#00569D` | ⚠ MD3 primary — text selection highlight ONLY; never for UI |
| `--menstrual` | `#D1495B` | Menstrual phase · also error banner |
| `--follicular` | `#2A9D8F` | Follicular phase · success |
| `--ovulatory` | `#FF9F00` | Ovulatory phase |
| `--luteal` | `#76489D` | Luteal phase |

**Two-blue rule:** `--md3-primary` (#00569D) and `--locket-blue` (#006EC7) are visually similar but semantically distinct. Locket Blue is for all UI chrome, action, and brand. MD3 Primary exists only as a Material theme token (e.g. text selection background). Never apply `--md3-primary` to buttons, nav, or links.

Dark mode overlays: `--dark-bg: #252628`, `--dark-card: #323336`, `--dark-inset: #1C1C1E`, `--dark-text: #FFFFFF`, `--dark-body: #EBEBF5`, `--dark-secondary: #A0A0A5`

### Typography
- **Native fonts**: SF Pro (iOS, from design spec), Roboto (Android)
- **Web font**: Public Sans (Google Fonts)
- **Fallback stack**: `system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`

| Style | Size | Weight | Notes |
|---|---|---|---|
| H1 | 32px | 700 | Page titles, calendar month names |
| H2 | 24px | 700 | Section titles, card headers |
| Nav Title | 17px | 600 | Top bar titles, centered |
| Card Title | 15px | 700 | Data focus card headers |
| Body | 16px | 400 | Long-form text, notes, journal |
| Label | 14px | 500 | Active labels (Locket Blue), interactive text |
| Section Header | 13px | 700 | ALL CAPS, tracking 0.1em, Locket Blue |
| Pill Text | 13px | 500 | Symptom chips |
| Caption | 12px | 400 | Sub-labels, dates, meta |
| Meta/Spec | 11px | 400 | Monospaced specs, tracking wider |

### Spacing
```
xs:  4px   (tight inline gaps)
s:   8px   (component internal gaps)
m:   16px  (standard gap, chip rows)
l:   24px  (card internal padding)
xl:  32px  (color swatch grid)
2xl: 40px  (section-to-section spacing)
page-x: 20px (horizontal page margin)
```

### Border Radius
```
s:    4px   (small badges)
m:    8px   
l:    16px  (cards / containers — "xl tier")
btn:  12px  (buttons, inputs — "Safe-Touch")
pill: 999px (chips, tags, toggles)
seal: 50%   (IntegritySeal, encryption badge)
```

### Cards
- **Light mode**: white `#FFFFFF`, shadow `0 4px 20px -2px rgba(0,0,0,0.05)` — whisper-soft
- **Dark mode**: `#323336`, shadow `0 4px 20px -2px rgba(0,0,0,0.2)`, no border
- Inner nested areas use **R_outer - padding = R_inner** formula (e.g. 16px card → 12px inner)
- Internal padding: 24px (generous — "sensitive data deserves focus space")

### Shadows & Elevation
Three levels, all diffuse (large radius, small offset):
1. **Whisper** `0 4px 20px -2px rgba(0,0,0,0.05)` — cards (light)
2. **Soft** `0 2px 8px rgba(0,0,0,0.05)` — accordion rows, input fields
3. **Floated** `0 4px 16px rgba(0,0,0,0.2)` — floating toggle button

### Animations & Interactions
- **Press state**: `scale(0.98)` with smooth transition — "the button gently yields to touch"
- **Haptics**: Medium impact on primary actions, notification on warnings
- **IntegritySeal pulse**: `scale(1 → 1.5 → 1)`, 800ms easeInOut loop, used only for "syncing"
- **Accordion**: `LayoutAnimation.Presets.easeInEaseOut` (native)
- **No gratuitous animation** — everything is subtle, purposeful
- **Backdrop blur**: Nav bar and save footer use `backdrop-filter: blur(12px)` at 80% opacity

### Backgrounds
- Flat color only — no gradients, no textures, no patterns
- Nav bar: semi-transparent sand/dark + backdrop blur = frosted glass
- No full-bleed imagery in app screens

### Hover/Focus States
- Hover: `opacity: 0.8` (links, secondary buttons)
- Focus: soft Locket Blue ring at 20% opacity (light) / 40% opacity (dark)
- No harsh outlines

---

## ICONOGRAPHY

Locket uses **Google Material Symbols** in a **two-tier system** confirmed from `CycleTrendsScreen.html` and the live screens.

| Tier | Font | FILL | Usage |
|---|---|---|---|
| **UI / structural** | Material Symbols Outlined | `0` | Navigation (`chevron_right`, `arrow_back`), actions (`history`, `timeline`, `search`), disclosure arrows |
| **Semantic / phase** | Material Symbols Rounded | `1` | Phase icons (`water_drop`, `eco`, `wb_sunny`, `mode_night`), mood/emotional states, security (`lock`) |

```css
/* Outlined — UI icons */
font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;

/* Rounded — semantic icons */
font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
```

**No emoji in UI.** Empty states, list items, and badges use Material Symbols — never system emoji (📥 etc), which break visual consistency and render inconsistently across OS.

**Icon badges:** 40×40 container, 12px radius (`--radius-btn`), 20px icon. Container bg uses the icon's phase tint (Blue Tint, Follicular Tint, etc.).

### Canonical Components (v2 — confirmed from live screens)

Not all in `design.md`; documented here because they appear in the real product:

| Component | Spec | Preview |
|---|---|---|
| **Phase Segmented Bar** | `grid-template-columns: repeat(N, 1fr)`, height 10px, gap 2px, radius 999px, predicted days use `#F2F2F7` | `preview/component-phase-bar.html` |
| **Underline tabs** | Top-level nav. Active: Locket Blue · 700 + 2px bottom border. Frosted backdrop. | `preview/component-nav.html` |
| **Pill tabs** | Sub-section switcher. Active: solid Locket Blue + white text. | `preview/component-nav.html` |
| **Letter avatar** | 40px circle, phase-color rotation hashed from initials, white · 700. | `preview/component-avatars.html` |
| **Error banner** | Full-width terracotta, white · 500, 12px radius, with rounded icon. | `preview/component-banners.html` |
| **Empty state** | 56px circle bg + Material Symbol at 28px Fog. Never emoji. | `preview/component-banners.html` |
| **Card variants** | V1 white+badge (default), V2 white+left-border (phase insight in list), V3 full tint (featured hero). | `preview/component-cards.html` |

### Key Icons (canonical)
`lock` · `arrow_back` · `chevron_right` · `history` · `timeline` · `water_drop` (F1) · `eco` (F1) · `wb_sunny` (F1) · `mode_night` (F1) · `mood` (F1) · `error` (F1) · `info` (F1) · `inbox` · `share` · `qr_code_2`

---

## File Index

```
README.md                    ← This file
SKILL.md                     ← Agent skill definition
colors_and_type.css          ← CSS custom properties (tokens)
assets/                      ← Visual assets (none currently — see caveats)
preview/
  colors-foundation.html     ← Foundation color swatches
  colors-phase.html          ← Cycle phase colors
  colors-semantic.html       ← Semantic / trust colors
  type-scale.html            ← Typography scale specimen
  type-components.html       ← Component-level type (labels, pills, meta)
  spacing-tokens.html        ← Spacing & border radius tokens
  shadow-elevation.html      ← Shadow levels
  component-buttons.html     ← Button states
  component-inputs.html      ← Input & form elements
  component-chips.html       ← Pill chips / symptom tags
  component-cards.html       ← Data Focus Cards
  component-seal.html        ← IntegritySeal states
  component-nav.html         ← Navigation bar
  component-sections.html    ← Section header pattern
  dark-mode.html             ← Dark mode token demo
ui_kits/
  mobile_app/
    index.html               ← Interactive mobile app prototype
    LedgerScreen.jsx         ← Calendar / main screen
    LogScreen.jsx            ← Data entry / inscription
    InsightsScreen.jsx       ← Cycle insights + trends
    AuthScreen.jsx           ← Lock / unlock screen
    SettingsScreen.jsx       ← Settings screen
    Shared.jsx               ← Shared components (NavBar, Card, Chip, Seal, etc.)
```

---

## BRAND

### Logo Asset Set
All logo files live in `assets/logo/`. The mark is built from 5 SVG primitives: four phase-colored quarter arcs (the orbit ring), a filled inner circle (the well), a gold dot at 12 o'clock (the clasp/Integrity Seal made brand), and a lock icon (circle shackle + rounded-rect body).

| File | Use on |
|---|---|
| `locket-mark-light.svg` | White, sand, light surfaces |
| `locket-mark-dark.svg` | Dark charcoal, navy, dark mode |
| `locket-mark-transparent.svg` | Any colored background (inner fill: `none`) |
| `locket-mark-mono-ink.svg` | Single-color print, light bg |
| `locket-mark-badge-dark.svg` | Dark/colored bg; pin/badge contexts (white arcs + navy well) |

### Colors introduced by logo
- `--locket-navy: #1A2332` — dark mark inner well + lockup-dark background. Distinct from dark mode bg (`#252628`).

### Missing (not yet delivered)
- App icon master (1024×1024 mark on solid bg for App Store / Play Store)



1. **No logo asset** — Auth screen uses a gold circle placeholder. *Need: Locket logo SVG.*
2. **Back navigation fork** — `design.md` specs `arrow_back` icon; real iOS screens show text "‹ Back". System documents both; pick one for hi-fi mocks.
3. **Avatar color assignment** — phase-color rotation specced in `component-avatars.html`; hash logic is unimplemented in code.
4. **Dark mode** — tokens exist but screens incomplete in codebase; UI kit prototype is light mode only.

## Changelog

**v2** — Second-pass after audit of live screens + CycleTrendsScreen.html.
- Corrected `--paper` `#FDFBF7` → `#FDFBF9`, `--ink` `#1A1A1A` → `#1B1C1B`, `--fog` `#8E8E93` → `#717783`
- Added `--md3-primary` (#00569D) with restricted-use rule
- Split icon system into Outlined (UI) / Rounded (semantic)
- Added: Phase Segmented Bar spec, Letter Avatar, Error Banner, Empty State, 3 Card variants, Pill Tabs
- Removed emoji from Empty State and Accordions
