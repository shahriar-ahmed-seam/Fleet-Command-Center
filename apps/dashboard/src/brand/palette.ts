import { colors, type ColorToken } from '@fleet/design-tokens';

/**
 * Operator palette: a partial set of color-token overrides keyed by the same
 * token names the design system defines. Loaded from `palette.json`.
 */
export type Palette = Partial<Record<ColorToken, string>>;

/** Fully-resolved color set: every token has a concrete value. */
export type ResolvedColors = Record<ColorToken, string>;

/** `#rgb`, `#rrggbb`, or `#rrggbbaa` hex color. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** True when `value` is a syntactically valid hex color string. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}


export function mergePalette(overrides: Palette = {}): ResolvedColors {
  const resolved = { ...colors } as ResolvedColors;
  for (const token of Object.keys(resolved) as ColorToken[]) {
    const candidate = overrides[token];
    if (isHexColor(candidate)) {
      resolved[token] = candidate.trim();
    }
  }
  return resolved;
}

/** camelCase token name → kebab-case CSS variable suffix. */
function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** The CSS custom-property name for a color token (e.g. `--color-primary`). */
export function colorVarName(token: ColorToken): string {
  return `--color-${kebab(token)}`;
}

/**
 * Apply resolved colors as `--color-*` CSS custom properties on a root element
 * (defaults to `document.documentElement`). No-op outside a browser so the
 * module stays importable in tests and SSR.
 */
export function applyPaletteToDocument(
  resolved: ResolvedColors,
  root?: { style: { setProperty(name: string, value: string): void } },
): void {
  const target =
    root ??
    (typeof document !== 'undefined' ? document.documentElement : undefined);
  if (!target) return;
  for (const token of Object.keys(resolved) as ColorToken[]) {
    target.style.setProperty(colorVarName(token), resolved[token]);
  }
}

/**
 * Fetch and parse an operator `palette.json`. Returns an empty palette on any
 * network/parse failure so the caller falls back to defaults (never broken).
 */
export async function loadPalette(url: string): Promise<Palette> {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const data: unknown = await res.json();
    if (data && typeof data === 'object') {
      return data as Palette;
    }
    return {};
  } catch {
    return {};
  }
}
