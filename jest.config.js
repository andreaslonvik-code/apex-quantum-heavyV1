/**
 * Jest config for unit-testing pure trading logic (entry-gate, mirror-plan).
 * Scoped to fast, dependency-light modules — no Alpaca/Supabase/Grok calls.
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: { module: 'commonjs', isolatedModules: true },
      },
    ],
  },
};
