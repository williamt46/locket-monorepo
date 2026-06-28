// Root ESLint flat config (ESLint 9). Applies to workspace packages that run
// `eslint src/` and have no local eslint.config.js of their own (portal-core,
// partner-portal, provider-portal). apps/web ships its own config, which takes
// precedence because ESLint resolves the nearest flat config from the cwd.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // Never lint build output, deps, caches, or the gitignored Fabric checkout.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'network/fabric-samples/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Allow intentionally-unused args/vars prefixed with _ (common in handlers).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Existing portal code uses `any` for decrypted payloads and caught errors.
      // Warn (don't block CI) so the gate goes green now and the debt stays
      // visible to burn down later — tracked separately from this CI setup.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
