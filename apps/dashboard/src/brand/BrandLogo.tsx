import React, { useState } from 'react';

import { useBrand } from './BrandProvider';
import { resolveBrandSlot } from './slots';

export interface BrandLogoProps {
  /** Accessible label for the logo/wordmark. */
  alt?: string;
  className?: string;
}

/** Neutral wordmark placeholder tile, styled from design tokens. */
function Wordmark({ text }: { text: string }): React.ReactElement {
  return (
    <div
      data-testid="brand-logo-placeholder"
      role="img"
      aria-label={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--space-2, 8px) var(--space-3, 12px)',
        borderRadius: 'var(--radius-control, 6px)',
        background: 'var(--color-surface-alt, #232E40)',
        color: 'var(--color-text, #E8EDF4)',
        fontFamily: 'var(--font-sans, sans-serif)',
        fontWeight: 600,
        fontSize: 'var(--font-size-lg, 20px)',
        lineHeight: 'var(--line-height-heading, 1.2)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}

/** Renders the operator logo or the wordmark placeholder. */
export function BrandLogo({ alt, className }: BrandLogoProps): React.ReactElement {
  const { assets } = useBrand();
  const [failed, setFailed] = useState(false);
  const slot = resolveBrandSlot(assets.logoUrl);

  if (slot.kind === 'placeholder' || failed) {
    return <Wordmark text={assets.wordmark} />;
  }

  return (
    <img
      data-testid="brand-logo-image"
      className={className}
      src={slot.src}
      alt={alt ?? assets.wordmark}
      onError={() => setFailed(true)}
      style={{ height: 'var(--space-6, 32px)', width: 'auto', display: 'block' }}
    />
  );
}
