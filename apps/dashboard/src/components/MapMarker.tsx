import React from 'react';
import { driverStatusVar } from '../theme/tokens';

export interface MapMarkerProps {
  /** Driver_Status value → marker color via the status palette. */
  status?: string;
  /** Explicit color override (wins over status). */
  color?: string;
  /** Heading in degrees clockwise from north; when set the arrow points along it. */
  heading?: number | null;
  /** Marker diameter in px. */
  size?: number;
  /** Highlights the marker as selected. */
  selected?: boolean;
  /** Short label (e.g. vehicle identifier) shown beside the marker. */
  label?: string;
  onClick?: () => void;
}

/** Resolve the marker fill from an explicit color or the status palette. */
export function markerColor(props: Pick<MapMarkerProps, 'status' | 'color'>): string {
  if (props.color) return props.color;
  if (props.status) return driverStatusVar(props.status);
  return 'var(--color-primary)';
}

/** A directional, status-colored vehicle marker. */
export function MapMarker({
  status,
  color,
  heading = null,
  size = 26,
  selected = false,
  label,
  onClick,
}: MapMarkerProps): React.ReactElement {
  const fill = markerColor({ status, color });
  const hasHeading = typeof heading === 'number' && Number.isFinite(heading);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        cursor: onClick ? 'pointer' : 'default',
        transform: 'translate(-50%, -50%)',
        filter: selected ? 'drop-shadow(0 0 6px ' + 'rgba(56,189,248,0.9))' : 'none',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role="img"
        aria-label={`Vehicle${label ? ' ' + label : ''}${status ? ', ' + status : ''}`}
        style={{
          transition: 'transform 600ms ease',
          transform: hasHeading ? `rotate(${heading}deg)` : 'none',
        }}
      >
        {selected && (
          <circle cx="12" cy="12" r="11" fill="none" stroke={fill} strokeOpacity="0.35" strokeWidth="2" />
        )}
        {hasHeading ? (
          // Upward-pointing arrow (north); the wrapper rotation aims it at heading.
          <path
            d="M12 2 L19 20 L12 16 L5 20 Z"
            fill={fill}
            stroke="var(--color-bg)"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <circle cx="12" cy="12" r="6" fill={fill} stroke="var(--color-bg)" strokeWidth="2" />
          </>
        )}
      </svg>
      {label && (
        <span
          className="mono"
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            color: 'var(--color-text)',
            background: 'color-mix(in srgb, var(--color-bg) 70%, transparent)',
            padding: '1px var(--space-1)',
            borderRadius: 'var(--radius-control)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
