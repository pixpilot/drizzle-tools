import baseConfig from '@internal/eslint-config/base';

// Uncomment to use the internal ESLint config if available
// /** @type {import('@internal/eslint-config').Config} */
/** @type {import('typescript-eslint').Config} */
export default [
  ...baseConfig,
  {
    name: 'drizzle-pg/test-fixtures',
    files: ['test/**/*.ts'],
    rules: {
      // The tables here are throwaway fixtures for asserting generated DDL,
      // and some of them exist precisely to contrast `timestamp` with the
      // `timestamptz` helper this package ships.
      'drizzle/require-enable-rls': 'off',
      'drizzle/prefer-timestamptz': 'off',
    },
  },
];
