import { Platform } from 'react-native';

/**
 * Public Sans is the design-system typeface (loaded in App.js via
 * @expo-google-fonts/public-sans). Each weight is its own font family in RN,
 * so use font(weight) when a style needs a specific weight — combining a
 * single family with fontWeight relies on synthesized faces.
 */

const FAMILIES: Record<number, string> = {
    400: 'PublicSans_400Regular',
    500: 'PublicSans_500Medium',
    600: 'PublicSans_600SemiBold',
    700: 'PublicSans_700Bold',
    800: 'PublicSans_800ExtraBold',
};

export const font = (weight: 400 | 500 | 600 | 700 | 800 = 400): string => FAMILIES[weight];

export const typography = {
    // Legacy keys — kept so unmigrated screens keep compiling; all map to Public Sans now.
    serif: FAMILIES[600],
    heading: FAMILIES[600],
    body: FAMILIES[400],
    sans: FAMILIES[400],

    mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),

    sizes: {
        h1: 32,
        h2: 24,
        body: 16,
        caption: 12,
    },

    weights: {
        regular: '400',
        bold: '700',
    },
};
