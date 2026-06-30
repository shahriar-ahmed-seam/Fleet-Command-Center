import { colors, type ColorToken } from '@fleet/design-tokens';

/** Pure white, used for filled-control labels (not a semantic token). */
export const WHITE = '#FFFFFF';

/** AA threshold category for a color pairing. */
export type ContrastLevel = 'normal' | 'large';

/** The minimum contrast ratio required for each category. */
export const AA_THRESHOLD: Record<ContrastLevel, number> = {
  normal: 4.5,
  large: 3,
};

/** Parse a `#rgb` / `#rrggbb` hex string to 8-bit RGB channels. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.trim().replace(/^#/, '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** sRGB channel (0..255) → linearized component for luminance. */
function linearize(channel8: number): number {
  const c = channel8 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a hex color per WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio (1..21) between two hex colors per WCAG 2.1. */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** A foreground/background token pairing with the AA level it must satisfy. */
export interface ColorPair {
  /** Foreground hex (resolved from a token or WHITE). */
  fg: string;
  /** Background hex (resolved from a token). */
  bg: string;
  /** Human-readable description for failure messages. */
  name: string;
  /** Threshold category this pairing is held to. */
  level: ContrastLevel;
}

const c = (t: ColorToken): string => colors[t];

/** Build a pairing entry, resolving token names to their hex values. */
function pair(
  fg: ColorToken | typeof WHITE,
  bg: ColorToken,
  level: ContrastLevel,
): ColorPair {
  const fgHex = fg === WHITE ? WHITE : c(fg);
  const fgName = fg === WHITE ? 'white' : fg;
  return { fg: fgHex, bg: c(bg), name: `${fgName} on ${bg}`, level };
}

/** The three app background surfaces body content sits on. */
const SURFACES: ColorToken[] = ['bg', 'surface', 'surfaceAlt'];

/** Saturated colors used as status-pill / filled backgrounds with dark labels. */
const PILL_BACKGROUNDS: ColorToken[] = [
  'primary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'textMuted',
];

/** Foreground colors used as icons, markers, and graphical boundaries. */
const FOREGROUND_ACCENTS: ColorToken[] = [
  'primary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
];


export const CONTRAST_PAIRS: ColorPair[] = [
  // Body text on each app surface — normal text, ≥ 4.5:1.
  ...SURFACES.map((s) => pair('text', s, 'normal')),
  ...SURFACES.map((s) => pair('textMuted', s, 'normal')),
  // Dark labels on saturated status pills — normal text, ≥ 4.5:1.
  ...PILL_BACKGROUNDS.map((bg) => pair('bg', bg, 'normal')),
  // Status/brand colors as foreground icons, markers, and boundaries — ≥ 3:1.
  ...FOREGROUND_ACCENTS.flatMap((fg) =>
    SURFACES.map((s) => pair(fg, s, 'large')),
  ),
  // White labels on filled controls — only on colors that clear the UI threshold.
  pair(WHITE, 'primary', 'large'),
  pair(WHITE, 'primaryHover', 'large'),
  pair(WHITE, 'danger', 'large'),
];
