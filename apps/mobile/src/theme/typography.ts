import { Platform } from 'react-native';

export const typography = {
    // Using system Serif/Sans until custom fonts are loaded
    // Modern Minimalist Aesthetic
    serif: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'sans-serif' }), // Re-purposing 'serif' key for the secondary font to keep API consistent, or we can rename it. Let's keep 'serif' but map it to a modern font for now to avoid breaking changes, or better, rename to 'heading'.
    // actually, let's just make everything modern sans
    heading: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'sans-serif' }),
    body: Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif', default: 'sans-serif' }),

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
