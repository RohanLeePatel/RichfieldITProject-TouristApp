import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// The app is plain JavaScript (.js / .jsx), so that is what gets linted.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // the app doesn't use the React Compiler, so its extra checks (effects that
      // set state, refs during render...) only flag working code
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-refresh/only-export-components': 'warn',
      // `_name` marks a value that is deliberately left unused
      'no-unused-vars': ['error', { varsIgnorePattern: '^_|^[A-Z]', argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    // the small `node file.mjs` self-checks and the build config run in Node
    files: ['**/*.selfcheck.mjs', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
])
