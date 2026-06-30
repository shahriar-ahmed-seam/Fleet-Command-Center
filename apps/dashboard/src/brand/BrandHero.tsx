import React, { useState } from 'react';

import { useBrand } from './BrandProvider';
import { resolveBrandSlot } from './slots';

export interface BrandHeroProps {
  className?: string;
  children?: React.ReactNode;
}

const HERO_BASE_STYLE: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  minHeight: 'var(--space-8, 64px)',
  borderRadius: 'var(--radius-card, 10px)',
  overflow: 'hidden',
};

/** Tokened gradient used when no hero asset is available. */
const GRADIENT_PLACEHOLDER =
  'linear-gradient(135deg, var(--color-primary, #3B82F6), var(--color-accent, #14B8A6))';

/** Renders the operator hero image or the gradient placeholder. */
export function BrandHero({
  className,
  children,
}: BrandHeroProps): React.ReactElement {
  const { assets } = useBrand();
  const [failed, setFailed] = useState(false);
  const slot = resolveBrandSlot(assets.heroUrl);
  const showAsset = slot.kind === 'asset' && !failed;

  return (
    <div
      data-testid={showAsset ? 'brand-hero-image' : 'brand-hero-placeholder'}
      className={className}
      role="img"
      aria-label="Hero"
      style={{
        ...HERO_BASE_STYLE,
        background: showAsset
          ? `center / cover no-repeat url(${slot.src})`
          : GRADIENT_PLACEHOLDER,
      }}
    >
      {/* A hidden probe image lets us detect load failure and fall back to the
          gradient without ever showing a broken image element. */}
      {showAsset && (
        <img
          src={slot.src}
          alt=""
          aria-hidden="true"
          onError={() => setFailed(true)}
          style={{ display: 'none' }}
        />
      )}
      {children}
    </div>
  );
}
