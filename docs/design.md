# Design System: Locket UI
**Project ID:** `12288066480715369169`
**Device Type:** Mobile (iOS-primary, Android-compatible)
**Color Mode:** Adaptive (Light & Dark)
**Stitch Theme:** ROUND_TWELVE / Custom Color #006DC7 / Saturation 3

---

## 1. Visual Theme & Atmosphere

Locket's interface radiates **Empathetic Intimacy** — warm, softly luminous, and deeply private. The overall aesthetic is a marriage of clinical precision and journal-like tenderness: every surface feels like a trusted confidante rather than a sterile medical tool.

**Light Mode** breathes with a **sun-baked sand backdrop** (#FDFBF9) — warmer than clinical white, it wraps content in a cozy parchment glow. Cards float atop this warmth with whisper-soft shadows, creating a sense of gentle elevation without visual heaviness.

**Dark Mode** retreats into a **cool neutral darkness** (#252628) — a deep charcoal that is optimized for low-light comfort. Card surfaces lift gently at #323336, separated from the background by the subtlest of luminance shifts rather than harsh borders.

The overall density is **spacious and breathable**. Generous padding and deliberate whitespace around sensitive data points create "focus surfaces" — zones where the user's eye can rest without visual noise. The interface feels alive but never anxious: micro-animations on interactive elements (like a gentle `scale(0.98)` press on buttons) add responsiveness without jarring motion.

The philosophy can be summarized as: **a warm lantern in a quiet room — focused, safe, and softly glowing.**

---

## 2. Color Palette & Roles

### Foundation Colors

| Descriptive Name | Hex | Role |
|---|---|---|
| **Sun-Baked Sand** | `#FDFBF9` | Light mode background. Warmer than stark white, reducing eye strain during extended use. |
| **Cool Neutral Dark** | `#252628` | Dark mode background. A deep charcoal optimized for eye comfort in low light. |
| **Elevated Slate Card** | `#323336` | Dark mode card/container surface. Lifts content just above the dark background. |
| **Inset Darkness** | `#1C1C1E` | Dark mode inset surfaces (input fields, nested content areas). Creates depth within cards. |
| **Near-Black Ink** | `#1A1A1A` | Primary text in light mode. Rich and dense for maximum readability. |
| **Pure White** | `#FFFFFF` | Light mode card surface and dark mode primary text. |
| **Soft Fog** | `#EBEBF5` | Dark mode body text. A slightly warm off-white for comfortable reading. |
| **Neutral Whisper** | `#8E8E93` | Light mode secondary/meta text. Subdued without disappearing. |
| **Muted Steel** | `#A0A0A5` | Dark mode secondary/meta text. Equivalent of Neutral Whisper in dark context. |
| **Pale Lavender Mist** | `#F2F2F7` | Light mode input field background. A near-invisible tint for resting inputs. |

### Cycle Synchronization Colors (Dynamic)

These colors form a "living palette" that shifts with the user's biological rhythm, using hue to communicate phase status without relying on text.

| Descriptive Name | Hex | Phase & Character |
|---|---|---|
| **Warm Terracotta** | `#D1495B` | **Menstrual Phase.** A grounded, earthy rose that provides warmth without the urgency of diagnostic red. Icon: `water_drop`. Tinted background: `#FBEBEF` (light) / 20% opacity (dark). |
| **Arctic Teal** | `#2A9D8F` | **Follicular Phase.** A cool, clarifying green-blue symbolizing rising energy and renewal. Icon: `psychiatry`. |
| **Orange Peel** | `#FF9F00` | **Ovulatory Phase.** A vibrant, high-emphasis amber signifying the peak fertile window. Icon: `wb_sunny`. Tinted background: `#FFF4E5` (light) / 20% opacity (dark). |
| **Deep Reflective Violet** | `#76489D` | **Luteal Phase.** A rich, contemplative purple encouraging mindfulness and introspection. Icon: `mode_night`. |

### Trust & Security Color

| Descriptive Name | Hex | Role |
|---|---|---|
| **Locket Blue** (Primary) | `#006EC7` | The anchor color of the entire system. Used for primary action buttons, active labels, section headers, encryption badges, and focus rings. It conveys calm trustworthiness, data sovereignty, and professional care. Tinted background for badges: `#E5F1FA` (light) / 20% opacity (dark). Icon background for encryption indicators: solid fill. |

---

## 3. Typography Rules

### Font Stack
Locket uses **platform-native typefaces** to ensure maximum legibility and user trust:
- **iOS:** SF Pro Display, then system fallbacks (-apple-system, BlinkMacSystemFont)
- **Android:** Roboto, then Segoe UI, Helvetica, Arial, sans-serif
- **Rendering:** Antialiased for smooth edges on all platforms

### Type Scale

| Style | Size | Weight | Tracking | Leading | Usage |
|---|---|---|---|---|---|
| **Heading H1** | 32px | Bold (700) | Tight | Tight | Page titles, primary screen headers |
| **Heading H2** | 24px | Bold (700) | Tight | Tight | Section titles, card headers |
| **Nav Title** | 17px | Semibold (600) | Tight | — | Top navigation bar titles |
| **Card Title** | 15px | Bold (700) | — | — | Data Focus Card headers |
| **Body Regular** | 16px | Normal (400) | Normal | Relaxed (1.5) | Long-form text, descriptions, journal entries |
| **Label / Subtext** | 14px | Medium (500) | — | — | Active labels, interactive text, rendered in Locket Blue |
| **Component Label** | 14px | Medium (500) | — | — | Component titles within cards |
| **Pill Text** | 13px | Medium (500) | — | — | Symptom chip labels, secondary actions |
| **Section Header** | 13px | Bold (700) | Wide (0.1em) | — | Uppercase section dividers (e.g., "TYPOGRAPHY", "COMPONENTS"), rendered in Locket Blue with leading icon |
| **Caption / Detail** | 12px | Normal (400) | — | — | Sub-labels, hex code annotations, encryption reassurance text |
| **Meta / Spec** | 11px | Normal (400) | Wider | — | Monospaced specification text (e.g., "32px / Bold / Tracking: Tight"), rendered in Neutral Whisper |
| **Swatch Label** | 10px | Normal (400) | — | — | Monospaced hex codes beneath color swatches |

### Contrast
All body text maintains a minimum **4.5:1 contrast ratio** against the primary background tokens in both light and dark modes.

---

## 4. Component Stylings

### Buttons (Primary Action)
- **Shape:** Generously rounded corners (12px radius, the "Safe-Touch" standard) — wide enough to feel pressable on mobile, never sharp or aggressive.
- **Color:** Solid Locket Blue (#006EC7) fill with pure white text.
- **Sizing:** Full-width within cards, 14px vertical padding for a comfortable touch target.
- **Behavior:** On press, a subtle `scale(0.98)` transform with smooth transition — tactile feedback that feels like the button gently yields to the touch.
- **Typography:** Semibold weight for clear call-to-action visibility.

### Cards / Containers (Data Focus Cards)
- **Corner Roundness:** Softly rounded (16px radius, the "xl" tier) — wider than buttons, giving cards a padded, protective feel.
- **Light Mode:** Pure white (#FFFFFF) background with a whisper-soft diffused shadow (`0 4px 20px -2px rgba(0,0,0,0.05)`). The shadow is so light it creates presence through volume rather than contrast.
- **Dark Mode:** Elevated Slate (#323336) background with a slightly more pronounced shadow (`0 4px 20px -2px rgba(0,0,0,0.2)`). No border needed — luminance difference alone creates separation.
- **Nested Elements:** For inner content areas within cards, apply the formula **R_outer - Padding = R_inner** (e.g., a 16px card with padding contains a 12px inner area). Inner areas use Pale Lavender Mist (light) or Inset Darkness (dark).
- **Whitespace:** Generous internal padding (24px / p-6) — enough that content breathes within the card. This is intentional: sensitive data deserves focus space.
- **Icon Badges:** Small icon containers (e.g., chart icons) use a tinted Locket Blue background (`#E5F1FA` light / 20% opacity dark) with a subtle 12px rounded corner.

### Inputs / Forms
- **Shape:** Subtly rounded corners (12px radius), matching buttons for visual harmony.
- **Light Mode:** Near-invisible Pale Lavender Mist (#F2F2F7) background at 50% opacity. No border. Placeholder text in Neutral Whisper.
- **Dark Mode:** Inset Darkness (#1C1C1E) background with a hair-thin border (`border-white/5`). Placeholder text in Muted Steel.
- **Focus State:** A soft focus ring in Locket Blue at 20% opacity (light) / 40% opacity (dark). No harsh outlines.
- **Leading Icon:** Search or contextual icon positioned inside the input, left-aligned, in Neutral Whisper / Muted Steel.

### Pill Elements (Symptom Chips / Selection Tags)
- **Shape:** Fully pill-shaped (999px radius) — perfectly ovoid, evoking community and inclusiveness.
- **Light Mode:** Each chip uses a pale tinted background matching its semantic color (e.g., `#FBEBEF` for Menstrual-themed symptoms) with the full-strength semantic color for text.
- **Dark Mode:** Semantic color at 20% opacity for background, full-strength semantic color for text.
- **Content:** Leading Material Symbol icon (16px, filled) + label text (13px, medium weight).
- **Add Action:** Neutral chip with Pale Lavender Mist background (light) / white at 10% opacity (dark), plus `add` icon.

### Security & Iconography (Privacy Cues)
- **Encryption Badge:** A circular avatar (40px, fully rounded) filled solid with Locket Blue, containing a white `lock` icon (20px, filled). Placed alongside "Data Encrypted" reassurance text.
- **Badge Container:** Set against a softened trust-blue background (`#F2F8FD` light / Inset Darkness with white/5 border in dark), with generous padding and rounded-xl corners. This creates a "safe zone" visual.
- **Icon Style:** Google Material Symbols, with `FILL: 1, wght: 400, GRAD: 0, opsz: 24` — solidly filled, medium weight, creating a friendly and readable icon set. Icons should feel approachable, not clinical.

---

## 5. Layout Principles

### Page Structure
- **Container:** Single-column mobile layout, max-width constrained to `max-w-md` (448px). Content is horizontally centered within the viewport.
- **Minimum Height:** Each page fills at least the full viewport height (`100dvh`), with a minimum of 884px to prevent content collapse on smaller screens.

### Navigation Bar
- **Height:** 64px (h-16), sticky to top with high z-index.
- **Background:** Semi-transparent with backdrop blur — Sand at 80% opacity (light) / Dark at 80% opacity with bottom border at white/5 (dark). This creates a frosted-glass effect that maintains context while scrolling.
- **Content:** Back arrow icon (left) + centered title (17px semibold) with right padding to optically center the title.

### Spacing Strategy
- **Page Padding:** 20px horizontal (px-5), creating comfortable thumb-zone margins on mobile.
- **Section Spacing:** 40px vertical gap (space-y-10) between major sections — generous breathing room between distinct content areas.
- **Card Internal Padding:** 24px (p-6) — luxurious internal breathing space.
- **Component Spacing Within Cards:** 16px-24px vertical gaps (space-y-4 to space-y-6) between interactive elements.
- **Color Swatch Grid:** 3-column grid with 16px horizontal gap and 32px vertical gap (gap-x-4, gap-y-8).
- **Bottom Safe Area:** 80px (h-20) empty div at page bottom — ensures content doesn't get clipped by mobile navigation bars.

### Section Headers
- Uppercase, wide-tracked (0.1em), 13px bold in Locket Blue, with a leading Material Symbol icon and 16px bottom margin. These act as gentle dividers, marking territory without creating harsh visual lines.

---

## 6. Iconography Philosophy

Locket uses **Google Material Symbols (Outlined, Filled)** with the following variation settings:
- `FILL: 1` — Solidly filled for warmth and approachability
- `wght: 400` — Medium weight, balanced between presence and subtlety
- `GRAD: 0` — No exaggerated depth
- `opsz: 24` — Optical size optimized for standard UI use

### Phase Icons
| Phase | Icon | Character |
|---|---|---|
| Menstrual | `water_drop` | A single drop — universal, non-clinical |
| Follicular | `psychiatry` | Growth, emerging energy |
| Ovulatory | `wb_sunny` | Peak brightness, radiance |
| Luteal | `mode_night` | Reflection, winding down |
| Security | `lock` | Data sovereignty, trust |

### Interaction Icons
- **Navigation:** `arrow_back` for back navigation
- **Search:** `search` for input field leading icons
- **Add:** `add` for adding new symptoms/entries
- **Mood:** `mood_bad`, `sentiment_satisfied` for emotional logging — these feel personal rather than diagnostic
- **Analytics:** `bar_chart` for data visualization indicators

---

## 7. Adaptive Behavior (Light ↔ Dark)

| Element | Light Mode | Dark Mode |
|---|---|---|
| Page Background | Sun-Baked Sand `#FDFBF9` | Cool Neutral Dark `#252628` |
| Card Background | Pure White `#FFFFFF` | Elevated Slate `#323336` |
| Inset / Input Background | Pale Lavender Mist `#F2F2F7` @ 50% | Inset Darkness `#1C1C1E` |
| Primary Text | Near-Black Ink `#1A1A1A` | Pure White `#FFFFFF` |
| Body Text | Near-Black Ink `#1A1A1A` | Soft Fog `#EBEBF5` |
| Secondary Text | Neutral Whisper `#8E8E93` | Muted Steel `#A0A0A5` |
| Shadow Intensity | `rgba(0,0,0,0.05)` | `rgba(0,0,0,0.2)` |
| Card Border | None | None (luminance separation only) |
| Input Border | None | `border-white/5` (hair-thin) |
| Nav Bar Border | None | `border-white/5` (bottom edge) |
| Semantic Chip BG | Tinted pastel (e.g., `#FBEBEF`) | 20% opacity of semantic color |
| Nav Bar BG | `#FDFBF9` @ 80% + blur | `#252628` @ 80% + blur |
| Focus Ring | Locket Blue @ 20% | Locket Blue @ 40% |

---

> **Usage Note:** This DESIGN.md is optimized for use as a Stitch prompt prefix. When generating new screens, include the relevant sections as context (e.g., "Use the Locket design system: Empathetic Intimacy atmosphere, Sun-Baked Sand background, Safe-Touch 12px rounded buttons, Data Focus Cards with 16px corners and generous whitespace, Locket Blue #006EC7 for primary actions..."). Stitch interprets design through visual descriptions supported by specific color values.
