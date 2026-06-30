import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { resolveBrandSlot } from './slots';
import { pbtParams, tag } from '../testing/pbt';

/**
 * Arbitrary spanning the full asset-input space a branding slot can receive:
 * absent values, blank/whitespace strings (which must resolve to a placeholder,
 * never a broken asset), and plausible non-blank URLs.
 */
const assetInput: fc.Arbitrary<string | null | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(''),
  // Whitespace-only strings must be treated as "no asset".
  fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { maxLength: 5 }),
  // Plausible asset URLs / paths, including those needing trimming.
  fc.webUrl(),
  fc.constantFrom('/logo.svg', '/assets/hero.jpg', 'https://cdn.example.com/brand/mark.png'),
  fc.string().map((s) => `  ${s}  `),
);

describe(
  tag(38, 'branding slots render an asset or a defined placeholder, never broken'),
  () => {
    it('always resolves logo and hero slots to a defined render', () => {
      fc.assert(
        fc.property(assetInput, assetInput, (logoUrl, heroUrl) => {
          for (const url of [logoUrl, heroUrl]) {
            const slot = resolveBrandSlot(url);

            // Every slot resolves to exactly one defined outcome.
            expect(slot.kind === 'asset' || slot.kind === 'placeholder').toBe(true);

            if (slot.kind === 'asset') {
              // An asset render must carry a non-empty, trimmed source — never a
              // broken/empty reference.
              expect(typeof slot.src).toBe('string');
              expect(slot.src.length).toBeGreaterThan(0);
              expect(slot.src).toBe(slot.src.trim());
              // The source is derived from a non-blank input.
              expect(String(url).trim().length).toBeGreaterThan(0);
            } else {
              // The placeholder is chosen exactly when there is no usable asset.
              const blank = url == null || String(url).trim() === '';
              expect(blank).toBe(true);
            }
          }
        }),
        pbtParams(),
      );
    });
  },
);
