import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'public',
    'node_modules',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Pure domain core: no React, no DOM libraries, no Dexie (docs/PROJECT_RULES.md §4).
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'react/*'], message: 'src/domain must stay framework-free.' },
            { group: ['dexie', 'dexie-*'], message: 'src/domain must not touch persistence.' },
            {
              group: ['**/ui/**', '**/features/**', '**/services/**', '**/three/**', '**/measurement/**'],
              message: 'src/domain must not import outer layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts', 'e2e/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
]);
