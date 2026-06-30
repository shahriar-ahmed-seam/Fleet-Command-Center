import { describe, it, expect } from 'vitest';
import { colors } from '@fleet/design-tokens';

import {
  mergePalette,
  isHexColor,
  colorVarName,
  resolveBrandSlot,
} from './index';

describe('isHexColor', () => {
  it('accepts #rgb, #rrggbb, and #rrggbbaa', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('#3B82F6')).toBe(true);
    expect(isHexColor('#3B82F6CC')).toBe(true);
  });

  it('rejects malformed or non-string values', () => {
    expect(isHexColor('blue')).toBe(false);
    expect(isHexColor('#12')).toBe(false);
    expect(isHexColor('3B82F6')).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
    expect(isHexColor(123)).toBe(false);
  });
});

describe('mergePalette', () => {
  it('returns the full default token set when no overrides are given', () => {
    expect(mergePalette()).toEqual(colors);
  });

  it('applies valid hex overrides and preserves the rest', () => {
    const resolved = mergePalette({ primary: '#123456', accent: '#abcdef' });
    expect(resolved.primary).toBe('#123456');
    expect(resolved.accent).toBe('#abcdef');
    expect(resolved.bg).toBe(colors.bg); // untouched default
  });

  it('ignores malformed overrides, falling back to defaults (never broken)', () => {
    const resolved = mergePalette({
      primary: 'not-a-color',
      danger: '#xyz123',
    } as Record<string, string>);
    expect(resolved.primary).toBe(colors.primary);
    expect(resolved.danger).toBe(colors.danger);
  });

  it('produces a complete color set for every token', () => {
    const resolved = mergePalette({ primary: '#000000' });
    for (const token of Object.keys(colors)) {
      expect(typeof resolved[token as keyof typeof colors]).toBe('string');
    }
  });
});

describe('colorVarName', () => {
  it('maps token names to kebab-case CSS variables', () => {
    expect(colorVarName('primary')).toBe('--color-primary');
    expect(colorVarName('surfaceAlt')).toBe('--color-surface-alt');
    expect(colorVarName('textMuted')).toBe('--color-text-muted');
  });
});

describe('resolveBrandSlot', () => {
  it('resolves a non-empty URL to the asset', () => {
    expect(resolveBrandSlot('/logo.svg')).toEqual({
      kind: 'asset',
      src: '/logo.svg',
    });
  });

  it('resolves missing/blank URLs to the placeholder (never broken)', () => {
    expect(resolveBrandSlot(undefined)).toEqual({ kind: 'placeholder' });
    expect(resolveBrandSlot(null)).toEqual({ kind: 'placeholder' });
    expect(resolveBrandSlot('')).toEqual({ kind: 'placeholder' });
    expect(resolveBrandSlot('   ')).toEqual({ kind: 'placeholder' });
  });
});
