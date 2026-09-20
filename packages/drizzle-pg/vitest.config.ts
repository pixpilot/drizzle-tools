import baseConfig from '@internal/vitest-config';
import { mergeConfig } from 'vitest/config';

// The public surface here is mostly types, so `*.test-d.ts` runs under tsc
// alongside the behaviour suite rather than only being checked by `typecheck`.
export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
  },
});
