import React from 'react';

export interface StatCardProps {
  label: React.ReactNode;
  value: number | string;
  /** Accent color (typically a status token var); defaults to primary. */
  accent?: string;
  /** Optional click handler (e.g. to apply a filter). */
  onClick?: () => void;
  /** Visually marks the card as the active filter. */
  active?: boolean;
}

/** A token-styled metric tile. */
export function StatCard({
  label,
  value,
  accent = 'var(--color-primary)',
  onClick,
  active = false,
}: StatCardProps): React.ReactElement {
  const interactive = Boolean(onClick);
  return (
    <button
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={interactive ? active : undefined}
      disabled={!interactive}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        padding: 'var(--space-3)',
        textAlign: 'left',
        background: active ? 'var(--color-surface-alt)' : 'var(--color-surface)',
        border: `1px solid ${active ? accent : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-card)',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color 120ms ease, background 120ms ease',
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flex: '0 0 auto' }}
        />
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text)',
        }}
      >
        {value}
      </span>
    </button>
  );
}
