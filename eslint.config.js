// ABOUT: ESLint flat config for Takt (v9+).
// ABOUT: Covers SPA (React + browser), Worker (modules), test files, and Node config files.

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const UNUSED_VARS_RULE = [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  },
];

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      '.wrangler',
      'SPECIFICATIONS/prototype-design-files',
      'node_modules',
    ],
  },

  // SPA source (React + DOM)
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': UNUSED_VARS_RULE,
    },
  },

  // Worker source (no DOM globals)
  {
    files: ['worker/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {},
    },
    rules: {
      '@typescript-eslint/no-unused-vars': UNUSED_VARS_RULE,
    },
  },

  // Test files — more permissive
  {
    files: ['**/*.test.{ts,tsx}', 'src/test-utils/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': UNUSED_VARS_RULE,
    },
  },

  // Node scripts / config files
  {
    files: ['*.config.{ts,js}', 'eslint.config.js'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': UNUSED_VARS_RULE,
    },
  },
);
