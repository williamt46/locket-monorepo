---
name: locket-design
description: Use this skill to generate well-branded interfaces and assets for Locket, a privacy-preserving sovereign health journal app. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the Locket mobile experience.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference

**Philosophy:** Empathetic Intimacy — warm, private, journal-like. "A warm lantern in a quiet room."

**Brand vocabulary:** Ledger (data store), Inscription (log entry), Seal (integrity indicator), Locket (app/lock metaphor)

**Key colors:**
- Background: `#FDFBF7` (Sun-Baked Sand)
- Primary action: `#006EC7` (Locket Blue)
- Menstrual: `#D1495B` · Follicular: `#2A9D8F` · Ovulatory: `#FF9F00` · Luteal: `#76489D`
- Gold: `#D4AF37` (Integrity Seal secure state)

**Typography:** Public Sans (web) / Avenir Next (iOS native) — system-ui fallback
- Section headers: 13px, 700, ALL CAPS, tracking 0.1em, Locket Blue
- Body: 16px, 400, line-height 1.5

**Components:** Cards (16px radius, shadow `0 4px 20px -2px rgba(0,0,0,0.05)`), Buttons (12px "Safe-Touch"), Pills (999px), Integrity Seal (animated ring+dot)

**Icons:** Google Material Symbols, FILL:1, wght:400

**CSS tokens:** See `colors_and_type.css`
**UI kit:** See `ui_kits/mobile_app/index.html` for interactive prototype
