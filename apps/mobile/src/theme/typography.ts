import { Platform } from 'react-native';

export const typography = {
    // Using system Serif/Sans until custom fonts are loaded
    serif: Platform.select({ ios: 'Times New Roman', android: 'serif', default: 'serif' }),
    sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),

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
