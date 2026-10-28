const moduleNameMapper = { '^@/(.*)$': '<rootDir>/src/$1' };

// Logic tests (*.test.ts) run in plain Node; component tests (*.test.tsx) run in the React Native preset.
module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'jest-expo/node',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
      moduleNameMapper,
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.tsx'],
      moduleNameMapper,
    },
  ],
};
