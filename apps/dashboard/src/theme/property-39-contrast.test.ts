import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  CONTRAST_PAIRS,
  AA_THRESHOLD,
  contrastRatio,
  type ColorPair,
} from './contrast';
import { pbtParams, tag } from '../testing/pbt';

describe(tag(39, 'token color pairs meet WCAG AA contrast thresholds'), () => {
  it('every defined design-system pairing meets its AA threshold', () => {
    const pairArb: fc.Arbitrary<ColorPair> = fc.constantFrom(...CONTRAST_PAIRS);
    fc.assert(
      fc.property(pairArb, (pair) => {
        const ratio = contrastRatio(pair.fg, pair.bg);
        const threshold = AA_THRESHOLD[pair.level];
        // The ratio for this pairing must clear its AA threshold.
        expect(
          ratio,
          `${pair.name} (${pair.level}) contrast ${ratio.toFixed(2)} < ${threshold}`,
        ).toBeGreaterThanOrEqual(threshold);
      }),
      pbtParams(),
    );
  });

  it('covers the curated pairing set (sanity: non-empty, valid ratios)', () => {
    expect(CONTRAST_PAIRS.length).toBeGreaterThan(0);
    for (const pair of CONTRAST_PAIRS) {
      const ratio = contrastRatio(pair.fg, pair.bg);
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThanOrEqual(21);
    }
  });
});
