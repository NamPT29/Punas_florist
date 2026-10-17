// Kiểm tra lỗi code: npx eslint web tests
export default [
  {
    files: ['web/**/*.js', 'tests/**/*.js', 'tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', location: 'readonly', history: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', globalThis: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly', File: 'readonly', FileReader: 'readonly', Image: 'readonly',
        FormData: 'readonly', fetch: 'readonly', confirm: 'readonly', caches: 'readonly', self: 'readonly', Response: 'readonly',
        Intl: 'readonly', process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-undef': 'error',
    },
  },
];
