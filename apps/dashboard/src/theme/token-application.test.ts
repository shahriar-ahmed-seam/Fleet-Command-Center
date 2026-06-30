import { test, expect } from 'vitest';
import { toCss } from '@fleet/design-tokens';
import {
  AA_THRESHOLD,
  CONTRAST_PAIRS,
  contrastRatio,
} from './contrast';

test('design tokens emit the full custom-property layer', () => {
  const css = toCss();

  // Color tokens consumed across components.
  for (const v of [
    '--color-bg',
    '--color-surface',
    '--color-text',
    '--color-primary',
    '--color-accent',
    '--color-success',
    '--color-danger',
  ]) {
    expect(css).toContain(v);
  }

  // Spacing, radius, and typography scales.
  expect(css).toContain('--space-1');
  expect(css).toContain('--radius-card');
  expect(css).toContain('--font-size-');

  // Driver_Status / Delivery_Status color mappings (status badges/markers).
  expect(css).toContain('--status-driver-');
  expect(css).toContain('--status-delivery-');
});

test('audited color pairings meet WCAG AA contrast thresholds', () => {
  for (const p of CONTRAST_PAIRS) {
    const ratio = contrastRatio(p.fg, p.bg);
    expect(
      ratio,
      `${p.name} (${p.level}) ratio ${ratio.toFixed(2)} < ${AA_THRESHOLD[p.level]}`,
    ).toBeGreaterThanOrEqual(AA_THRESHOLD[p.level]);
  }
});
