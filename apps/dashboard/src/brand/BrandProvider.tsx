import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  applyPaletteToDocument,
  loadPalette,
  mergePalette,
  type Palette,
  type ResolvedColors,
} from './palette';

/** Operator brand assets; any may be absent (placeholders fill the gap). */
export interface BrandAssets {
  
  logoUrl?: string | null;
  
  heroUrl?: string | null;
  /** Wordmark shown when no logo asset is supplied. */
  wordmark?: string;
}

/** Value exposed to consumers of the brand context. */
export interface BrandContextValue {
  assets: Required<Pick<BrandAssets, 'wordmark'>> & BrandAssets;
  colors: ResolvedColors;
}

const DEFAULT_WORDMARK = 'Fleet Command Center';

const BrandContext = createContext<BrandContextValue | null>(null);

export interface BrandProviderProps {
  /** Inline palette overrides (takes effect immediately). */
  palette?: Palette;
  /** URL to fetch `palette.json` from at runtime (e.g. `/palette.json`). */
  paletteUrl?: string;
  /** Operator brand assets. */
  assets?: BrandAssets;
  children?: React.ReactNode;
}

/**
 * Provides resolved brand colors and assets to the React tree and keeps the
 * document's CSS color variables in sync with the active palette.
 */
export function BrandProvider({
  palette,
  paletteUrl,
  assets,
  children,
}: BrandProviderProps): React.ReactElement {
  const [loaded, setLoaded] = useState<Palette>({});

  // Fetch palette.json once at runtime when a URL is provided. A failed load
  // resolves to an empty palette, leaving the defaults in place (never broken).
  useEffect(() => {
    let cancelled = false;
    if (paletteUrl) {
      void loadPalette(paletteUrl).then((p) => {
        if (!cancelled) setLoaded(p);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [paletteUrl]);

  const colors = useMemo(
    () => mergePalette({ ...loaded, ...palette }),
    [loaded, palette],
  );

  // Reflect the resolved palette onto the document's CSS custom properties.
  useEffect(() => {
    applyPaletteToDocument(colors);
  }, [colors]);

  const value = useMemo<BrandContextValue>(
    () => ({
      colors,
      assets: {
        logoUrl: assets?.logoUrl ?? null,
        heroUrl: assets?.heroUrl ?? null,
        wordmark: assets?.wordmark ?? DEFAULT_WORDMARK,
      },
    }),
    [colors, assets],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

/** Access the brand context; throws if used outside a BrandProvider. */
export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return ctx;
}
