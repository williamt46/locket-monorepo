import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
        testTimeout: 10_000,
        deps: {
            optimizer: {
                web: {
                    include: ['@craftzdog/react-native-buffer', 'react-native-quick-crypto']
                }
            }
        }
    },
});
