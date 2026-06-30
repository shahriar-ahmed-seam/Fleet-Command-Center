import React from 'react';
import type { ConnectionState } from '../realtime/socketClient';

const PRESENTATION: Record<
  ConnectionState,
  { label: string; color: string; pulse: boolean }
> = {
  connected: { label: 'Live', color: 'var(--color-success)', pulse: false },
  connecting: { label: 'Connecting', color: 'var(--color-info)', pulse: true },
  reconnecting: { label: 'Reconnecting', color: 'var(--color-warning)', pulse: true },
  offline: { label: 'Offline', color: 'var(--color-danger)', pulse: false },
};

export interface ConnectionIndicatorProps {
  state: ConnectionState;
}

/** Renders the live connection status as a token-styled pill. */
export function ConnectionIndicator({
  state,
}: ConnectionIndicatorProps): React.ReactElement {
  const p = PRESENTATION[state];
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Connection: ${p.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: 28,
        padding: '0 var(--space-3)',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        color: 'var(--color-text)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: p.color,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${p.color} 25%, transparent)`,
          animation: p.pulse ? 'fcc-pulse 1.1s ease-in-out infinite' : undefined,
        }}
      />
      {p.label}
    </div>
  );
}
