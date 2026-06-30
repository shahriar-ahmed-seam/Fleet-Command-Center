/** The kinds of branding slot the dashboard renders. */
export type BrandSlot = 'logo' | 'hero';

/** Outcome of resolving a slot: a concrete asset or the neutral placeholder. */
export type SlotResolution =
  | { kind: 'asset'; src: string }
  | { kind: 'placeholder' };

/**
 * Resolve a slot from a (possibly missing) asset URL. A non-empty, non-blank
 * string yields the asset; anything else (undefined, null, empty, whitespace)
 * yields the placeholder. This guarantees a defined render for every input.
 */
export function resolveBrandSlot(url?: string | null): SlotResolution {
  if (typeof url === 'string' && url.trim() !== '') {
    return { kind: 'asset', src: url.trim() };
  }
  return { kind: 'placeholder' };
}
