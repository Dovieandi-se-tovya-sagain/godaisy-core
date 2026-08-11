/**
 * The tests in this repo were written and then never run: there was no runner,
 * no @types/jest, and no workflow executing anything. 145 cases across 6 files
 * sat inert, and because their `it`/`expect`/`jest` identifiers did not
 * resolve, they also accounted for 687 of the 819 errors `npm run lint`
 * reported -- so the typecheck was red for the same reason the tests were dead.
 *
 * diagnostics is off deliberately. Type errors are `npm run lint`'s job
 * (tsc --noEmit); making ts-jest fail a test on a type error would merge two
 * signals that are worth keeping apart, and would stop a behavioural suite
 * from running at all over an unrelated missing @types package.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },
  clearMocks: true,
};
