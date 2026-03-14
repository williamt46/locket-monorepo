# Unified Design Tokens Philosophy: The Sovereign Journal & Digital Ledger

This document outlines the design token philosophy for **Locket**, bridging the current generic "Modern Minimalist" tokens (`apps/mobile/src/theme`) with the required "Sovereign Journal" and "Digital Ledger" aesthetic defined in `@PRP_Frontend_v0.9.1.md`. 

The core goal is to reject sterile, clinical, or "soft" tech aesthetics (like large corner radii and faint drop shadows) in favor of a tactile, permanent, physical metaphor of ink, parchment, and cryptographic exactness.

## 1. Color Palette: Ink & Paper
The current palette uses generic tech colors (`#004080` inkBlue, `#2D2D2D` charcoal). The new philosophy shifts to high-contrast, physical equivalents.

*   **Backgrounds (The Canvas):** 
    Instead of bright sterile white (`#FFFFFF`) or generic off-white (`#FDFBF7`), use distinct unbleached paper tones.
    *   `background.primary`: `#F4F1EA` (Warm paper base)
    *   `background.surface`: `#E8E3D9` (Aged parchment for elevated cards)
    *   *(Dark Mode matches deep charcoal and slate to retain contrast without generic #000000).*
*   **Text (The Inscription):** 
    Instead of generic charcoal, use harsh, permanent ink colors.
    *   `text.primary`: `#1A1918` (Iron gall black – un-deletable contrast)
    *   `text.secondary`: `#5E5B56` (Faded graphite for metadata)
*   **Accents (The Seals & Keys):** 
    Retain the existing `alert: '#8B0000'` as a "Crimson Wax Seal". Introduce `success: '#315c45'` (Patina Green) for active keys and validity. Convert `gold: '#D4AF37'` to a slightly deeper `focus: '#D4B483'` (Burnished gold).

## 2. Typography: The Classical & The Cryptographic
The current `typography.ts` explicitly falls back to generic system fonts (`Avenir Next`, `sans-serif`) and states a "Modern Minimalist Aesthetic." This MUST be completely replaced.

*   **Primary Font (The Narrative):** `Crimson Pro` or `EB Garamond`.
    Used for headings, the astrolabe dashboard, and prose. It must feel like a classic, historical text, anchoring the "Journal" metaphor.
*   **Secondary Font (The Ledger):** `IBM Plex Mono` or `Space Mono`.
    Used for all UI labels, cryptographic hashes, timestamps, and exact ledger data. It provides the "Digital Ledger" utilitarian precision.

## 3. Layout & Component Styling: Hard Edges
The current `layout.ts` uses soft pill-shaped borders (`borderRadius: { s: 4, m: 8, l: 16 }`). This undermines the physical ledger aesthetic. 

*   **Corner Radii:** 
    Components must have sharp, exact corners defining their physical boundaries. 
    *   New Radii: `0px` (Square) or `2px` (Micro-rounding). Large `16px` or `24px` radii are strictly forbidden.
*   **Borders & Dividers:** 
    Use sharp, high-contrast borders (`1px solid #1A1918`). Use double-lined borders (`3px double`) for major section dividers, mimicking traditional accounting ledgers.
*   **Shadows & Elevation:** 
    Avoid soft, blurred dropshadows (`0 4px 12px rgba(0,0,0,0.1)`). Use solid, offset shadows (e.g., `3px 3px 0px 0px #1A1918`) to create a letterpress or stacked-paper effect.

## Migration Strategy
1.  **Refactor `colors.ts`**: Replace `inkBlue` and `charcoal` with the exact semantic tokens (`paper.base`, `ink.primary`, etc.) defined in the implementation plan.
2.  **Refactor `layout.ts`**: Strip out `l: 16` border radii. Introduce new shadow/elevation tokens using hard offsets.
3.  **Refactor `typography.ts`**: Remove system font fallbacks. Link the project to Google Fonts (via `expo-font`) for `Crimson Pro` and `IBM Plex Mono`.
