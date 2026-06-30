import React from 'react';
import { driverStatusVar, deliveryStatusVar } from '../theme/tokens';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const TONE_VAR: Record<BadgeTone, string> = {
  neutral: 'var(--color-text-muted)',
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
};

export interface BadgeProps {
  children: React.ReactNode;
  /** Explicit tone; ignored when a status is supplied. */
  tone?: BadgeTone;
  /** Driver_Status value; resolves to the status color. */
  driverStatus?: string;
  /** Delivery_Status value; resolves to the status color. */
  deliveryStatus?: string;
  /** Subtle variant: tinted background with colored text instead of a solid fill. */
  subtle?: boolean;
  style?: React.CSSProperties;
}

function resolveColor(props: BadgeProps): string {
  if (props.driverStatus) return driverStatusVar(props.driverStatus);
  if (props.deliveryStatus) return deliveryStatusVar(props.deliveryStatus);
  return TONE_VAR[props.tone ?? 'neutral'];
}

/** A status-colored pill. */
export function Badge(props: BadgeProps): React.ReactElement {
  const { children, subtle, style } = props;
  const c = resolveColor(props);
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    height: 22,
    padding: '0 var(--space-2)',
    borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };
  const skin: React.CSSProperties = subtle
    ? {
        // Tinted background derived from the status color; colored label.
        background: `color-mix(in srgb, ${c} 18%, transparent)`,
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`,
      }
    : { background: c, color: 'var(--color-bg)' };
  return <span style={{ ...base, ...skin, ...style }}>{children}</span>;
}
