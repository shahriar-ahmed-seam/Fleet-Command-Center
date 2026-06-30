/**
 * Jest configuration for the management service.
 *
 * Uses ts-jest so TypeScript property/unit tests run without a separate build
 * step. Property-based tests use fast-check (see src/testing/pbt.ts).
 *
 * `@fleet/contracts` now ships a dual CommonJS/ESM build, so the CommonJS test
 * runtime resolves its published `require` entry point directly — no module
 * name mapping workaround is needed.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
