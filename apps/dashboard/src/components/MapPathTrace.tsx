import React from 'react';

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Compute per-segment opacities for `segmentCount` segments ordered
 * oldest→newest, ramping linearly from `min` (oldest) to `max` (newest). Pure
 * so the fade behavior is testable.
 */
export function segmentOpacities(
  segmentCount: number,
  min = 0.15,
  max = 0.9,
): number[] {
  if (segmentCount <= 0) return [];
  if (segmentCount === 1) return [max];
  const out: number[] = [];
  for (let i = 0; i < segmentCount; i++) {
    out.push(min + ((max - min) * i) / (segmentCount - 1));
  }
  return out;
}

export interface MapPathTraceProps {
  /** Pre-projected screen points, oldest → newest. */
  points: ScreenPoint[];
  /** Trace color; defaults to the In_Transit/info token. */
  color?: string;
  strokeWidth?: number;
  /** SVG width/height (defaults to 100% of the positioned container). */
  width?: number | string;
  height?: number | string;
}

/** A chronological, fading path-trace polyline. */
export function MapPathTrace({
  points,
  color = 'var(--color-info)',
  strokeWidth = 3,
  width = '100%',
  height = '100%',
}: MapPathTraceProps): React.ReactElement | null {
  if (points.length < 2) return null;
  const opacities = segmentOpacities(points.length - 1);
  const head = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      aria-hidden="true"
    >
      {points.slice(1).map((p, i) => {
        const prev = points[i];
        return (
          <line
            key={i}
            x1={prev.x}
            y1={prev.y}
            x2={p.x}
            y2={p.y}
            stroke={color}
            strokeOpacity={opacities[i]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      })}
      {/* Leading head marks the most recent position on the trace. */}
      <circle cx={head.x} cy={head.y} r={strokeWidth + 1} fill={color} />
    </svg>
  );
}
