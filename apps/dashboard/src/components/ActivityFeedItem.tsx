import React from 'react';

export type ActivityTone = 'enter' | 'exit' | 'info';

const TONE: Record<ActivityTone, { color: string; glyph: string }> = {
  enter: { color: 'var(--color-info)', glyph: '↳' },
  exit: { color: 'var(--color-text-muted)', glyph: '↰' },
  info: { color: 'var(--color-accent)', glyph: '•' },
};

export interface ActivityFeedItemProps {
  tone?: ActivityTone;
  title: React.ReactNode;
  detail?: React.ReactNode;
  /** ISO timestamp or preformatted time string. */
  timestamp?: string;
  /** When true, plays a subtle entrance animation (newly arrived event). */
  fresh?: boolean;
}

function formatTime(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** A single activity-feed row. */
export function ActivityFeedItem({
  tone = 'info',
  title,
  detail,
  timestamp,
  fresh = false,
}: ActivityFeedItemProps): React.ReactElement {
  const t = TONE[tone];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-3)',
        borderBottom: '1px solid var(--color-border)',
        animation: fresh ? 'fcc-fade-in 200ms ease' : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          width: 22,
          height: 22,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: `color-mix(in srgb, ${t.color} 18%, transparent)`,
          color: t.color,
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
        }}
      >
        {t.glyph}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        {detail && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {detail}
          </div>
        )}
      </div>
      {timestamp && (
        <time
          className="mono"
          dateTime={timestamp}
          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', flex: '0 0 auto' }}
        >
          {formatTime(timestamp)}
        </time>
      )}
    </div>
  );
}
