/**
 * Locket design-system color tokens — single source of truth, reconciled with
 * docs/locket-design-system (ui_kits/mobile_app/Shared.jsx + colors_and_type.css).
 *
 * Phase palette uses the canonical menstrual/follicular/ovulatory/luteal
 * vocabulary. The old poetic names (warmTerracotta, arcticTeal, orangePeel,
 * deepReflectiveViolet) are kept as deprecated aliases so existing call sites
 * keep compiling — same hex values, one vocabulary going forward.
 */

export type PhaseName = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface ThemeTokens {
    paper: string;
    cardWhite: string;
    /** Text/glyph color that sits on a saturated fill (phase/brand color or a
     *  selected pill). Stays white in BOTH themes — unlike cardWhite, which
     *  darkens to a card surface in dark mode. */
    onAccent: string;
    charcoal: string;
    graphite: string;
    ink: string;
    fog: string;
    inkBlue: string;
    watermark: string;
    whisper: string;
    paleLavender: string;
    gold: string;
    alert: string;
    nearBlack: string;
    locketBlue: string;
    locketBlueTint: string;
    locketBlueBg: string;
    menstrual: string;
    menstrualTint: string;
    follicular: string;
    follicularTint: string;
    ovulatory: string;
    ovulatoryTint: string;
    ovulatoryDeep: string;
    luteal: string;
    lutealTint: string;
    logBg: string;
    navBg: string;
    divider: string;
    /** shadow color+opacity pair for the "whisper shadow" card treatment */
    shadowColor: string;
    shadowOpacity: number;
}

export const lightTokens: ThemeTokens = {
    paper: '#FDFBF9',
    cardWhite: '#FFFFFF',
    onAccent: '#FFFFFF',
    charcoal: '#2D2D2D',
    graphite: '#4A4A4A',
    ink: '#1B1C1B',
    fog: '#717783',
    inkBlue: '#004080',
    watermark: '#E6E2D8',
    whisper: '#8E8E93',
    paleLavender: '#F2F2F7',
    gold: '#D4AF37',
    alert: '#C0392B',
    nearBlack: '#1A1A1A',
    locketBlue: '#006EC7',
    locketBlueTint: '#E5F1FA',
    locketBlueBg: '#F2F8FD',
    menstrual: '#D1495B',
    menstrualTint: '#F8E5E7',
    follicular: '#2A9D8F',
    follicularTint: '#E4F3F1',
    ovulatory: '#FF9F00',
    ovulatoryTint: '#FFF2E0',
    ovulatoryDeep: '#E08C00',
    luteal: '#76489D',
    lutealTint: '#EDE7F2',
    logBg: '#F7F5FA',
    navBg: 'rgba(253,251,249,0.88)',
    divider: '#E6E2D8',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
};

// Dark layer — design system colors_and_type.css dark overrides.
export const darkTokens: ThemeTokens = {
    ...lightTokens,
    paper: '#252628',
    cardWhite: '#323336',
    charcoal: '#FFFFFF',
    graphite: '#EBEBF5',
    ink: '#FFFFFF',
    fog: '#A0A0A5',
    inkBlue: '#6FA8DC',
    watermark: 'rgba(255,255,255,0.08)',
    whisper: '#A0A0A5',
    paleLavender: '#1C1C1E',
    nearBlack: '#FFFFFF',
    locketBlueTint: 'rgba(0,110,199,0.20)',
    locketBlueBg: '#1C1C1E',
    menstrualTint: 'rgba(209,73,91,0.20)',
    follicularTint: 'rgba(42,157,143,0.20)',
    ovulatoryTint: 'rgba(255,159,0,0.20)',
    lutealTint: 'rgba(118,72,157,0.20)',
    logBg: '#252628',
    navBg: 'rgba(37,38,40,0.88)',
    divider: 'rgba(255,255,255,0.07)',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
};

export const phaseColor = (t: ThemeTokens, phase?: string): string =>
    ({ menstrual: t.menstrual, follicular: t.follicular, ovulatory: t.ovulatory, luteal: t.luteal } as Record<string, string>)[phase ?? ''] ?? t.locketBlue;

export const phaseTint = (t: ThemeTokens, phase?: string): string =>
    ({ menstrual: t.menstrualTint, follicular: t.follicularTint, ovulatory: t.ovulatoryTint, luteal: t.lutealTint } as Record<string, string>)[phase ?? ''] ?? t.locketBlueTint;

export const phaseLabel = (phase?: string): string =>
    ({ menstrual: 'Menstrual', follicular: 'Follicular', ovulatory: 'Ovulatory', luteal: 'Luteal' } as Record<string, string>)[phase ?? ''] ?? 'Unknown';

/**
 * Static light-palette export. Prefer useTheme() in themed screens; this stays
 * for screens not yet migrated to the ThemeContext.
 * The last block are deprecated aliases for the old phase vocabulary.
 */
export const colors = {
    ...lightTokens,

    /** @deprecated use menstrual */
    warmTerracotta: lightTokens.menstrual,
    /** @deprecated use menstrualTint */
    warmTerracottaTint: lightTokens.menstrualTint,
    /** @deprecated use follicular */
    arcticTeal: lightTokens.follicular,
    /** @deprecated use follicularTint */
    arcticTealTint: lightTokens.follicularTint,
    /** @deprecated use ovulatory */
    orangePeel: lightTokens.ovulatory,
    /** @deprecated use ovulatoryTint */
    orangePeelTint: lightTokens.ovulatoryTint,
    /** @deprecated use luteal */
    deepReflectiveViolet: lightTokens.luteal,
    /** @deprecated use lutealTint */
    deepReflectiveVioletTint: lightTokens.lutealTint,
    /** @deprecated use paleLavender */
    paleLavenderMist: lightTokens.paleLavender,
};
