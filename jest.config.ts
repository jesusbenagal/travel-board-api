import type { Config } from 'jest';

const common: Partial<Config> = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  roots: ['<rootDir>/src', '<rootDir>/test'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/main.ts'],
  coverageDirectory: '<rootDir>/coverage',
};

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      ...common,
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      displayName: 'e2e',
      ...common,
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
    },
  ],
};

export default config;
