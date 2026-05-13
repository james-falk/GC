import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Flat config for apps/web. We deliberately skip Next.js's bundled
// eslint preset (eslint-config-next) — as of Next 15.5.x the bundled
// @next/eslint-plugin-next still uses ESLint-8-only APIs (context.getScope,
// context.getAncestors) and crashes under ESLint 9. Most of those rules
// are Pages-Router-specific anyway (no-duplicate-head, no-css-tags,
// no-page-custom-font); the ones we'd actually want (image lint,
// link lint) are mild-correctness checks we can live without.
//
// What we care about: TypeScript correctness, react-hooks safety,
// no-unused-vars hygiene, no-explicit-any. typescript-eslint's recommended
// preset covers the first three; we layer the hooks plugin on top.

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'next-env.d.ts',
      'e2e/.auth/**',
      'e2e/test-results/**',
      'e2e/playwright-report/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Strict no-any with one carve-out: explicit-any in tests + script
      // shims is fine. Production code should never hit this.
      '@typescript-eslint/no-explicit-any': [
        'error',
        { ignoreRestArgs: true },
      ],

      // Allow underscore-prefixed unused vars (intentional ignores).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // The TS compiler enforces this with stricter semantics; ESLint's
      // version double-fires.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',

      // Allow `void someFire-and-forgetPromise()` — we use this pattern
      // for fire-and-log notifications in server actions.
      'no-void': 'off',
    },
  },

  // Tests + scripts: relax a couple of rules.
  {
    files: ['**/*.test.{ts,tsx}', 'scripts/**/*.{ts,mjs,js}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
