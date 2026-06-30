import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MIN_ITERATIONS, pbtParams, tag } from './pbt';

// Smoke test confirming the fast-check harness is wired with the project's
// min-100-iteration default and tag convention. Replaced by real property
// tests (Properties 14, 15, 33, 34, 38, 39) in later tasks.
describe(tag(0, 'PBT harness runs >=100 iterations'), () => {
  it('exercises fast-check with the min-100-iteration default', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a),
      pbtParams(),
    );
  });

  it('applies the project min-iteration default', () => {
    expect(pbtParams().numRuns).toBe(MIN_ITERATIONS);
    expect(MIN_ITERATIONS).toBeGreaterThanOrEqual(100);
  });
});
