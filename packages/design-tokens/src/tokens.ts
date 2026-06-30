/**
 * Semantic color tokens (dark operations theme placeholder defaults).
 * `success`/`warning`/`danger`/`info` double as the status palette consumed by
 * the Driver_Status / Delivery_Status mappings in `status.ts`.
 */
export const colors = {
  bg: '#070A16',
  surface: '#11152E',
  surfaceAlt: '#1A2042',
  border: '#2C3360',
  text: '#ECEEFA',
  textMuted: '#9AA2CC',
  primary: '#7C84F2',
  primaryHover: '#6A72E6',
  accent: '#58D6F2',
  success: '#3FE0A0',
  warning: '#ECA64C',
  danger: '#EF4757',
  info: '#8FB4FB',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Typography tokens: font families, a 1.25-ratio type scale (px), weights, and
 * line heights for body vs. headings.
 */
export const typography = {
  fontSans: '"Inter", system-ui, sans-serif',
  fontMono: '"JetBrains Mono", monospace',
  /** 1.25 modular scale, in pixels. */
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 20,
    xl: 25,
    '2xl': 31,
    '3xl': 39,
  },
  fontWeight: {
    body: 400,
    medium: 500,
    semibold: 600,
    emphasis: 700,
  },
  lineHeight: {
    body: 1.5,
    heading: 1.2,
  },
} as const;

/**
 * Spacing scale on a 4px base grid (px).
 */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

/**
 * Border-radius tokens (px). `pill` (9999) yields fully rounded pills/avatars.
 */
export const radius = {
  control: 8,
  card: 16,
  modal: 20,
  pill: 9999,
} as const;

/**
 * Elevation/shadow tokens for panels and popovers. Stored structurally so the
 * same token emits a CSS `box-shadow` string and a Flutter `BoxShadow`.
 */
export const shadows = {
  sm: { x: 0, y: 1, blur: 2, color: '#000000', alpha: 0.3 },
  md: { x: 0, y: 4, blur: 12, color: '#000000', alpha: 0.35 },
  lg: { x: 0, y: 12, blur: 32, color: '#000000', alpha: 0.45 },
} as const;

export type ShadowToken = keyof typeof shadows;

/** Format a shadow token as a CSS `box-shadow` value. */
export function shadowToCss(s: (typeof shadows)[ShadowToken]): string {
  const r = parseInt(s.color.slice(1, 3), 16);
  const g = parseInt(s.color.slice(3, 5), 16);
  const b = parseInt(s.color.slice(5, 7), 16);
  return `${s.x}px ${s.y}px ${s.blur}px rgba(${r}, ${g}, ${b}, ${s.alpha})`;
}

/**
 * The complete token set, grouped by category.
 */
export const tokens = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} as const;

export type Tokens = typeof tokens;
