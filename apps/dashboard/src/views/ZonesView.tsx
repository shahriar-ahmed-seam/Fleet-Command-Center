import React from 'react';
import { Card } from '../components';
import type { ZonePolygon } from '../map/LiveMap';
import type { VehicleState } from '../map/geo';

export interface ZonesViewProps {
  zones: ZonePolygon[];
  vehicles: VehicleState[];
}

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  const n = ring.length - 1;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** A miniature SVG outline of a zone polygon, normalized to its bounds. */
function ZoneGlyph({ ring }: { ring: [number, number][] }): React.ReactElement {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const pts = ring
    .map((p) => `${((p[0] - minX) / w) * 100},${(1 - (p[1] - minY) / h) * 60 + 4}`)
    .join(' ');
  return (
    <svg width="100%" height="72" viewBox="0 0 100 68" preserveAspectRatio="none">
      <polygon
        points={pts}
        fill="color-mix(in srgb, var(--color-accent) 16%, transparent)"
        stroke="var(--color-accent)"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Geo-fence overview: each zone with a live count of vehicles inside it. */
export function ZonesView({ zones, vehicles }: ZonesViewProps): React.ReactElement {
  return (
    <div style={{ padding: 'var(--space-4)', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {zones.map((z) => {
          const inside = vehicles.filter((v) => pointInRing(v.lng, v.lat, z.ring));
          return (
            <Card key={z.id} padding={4}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>{z.name}</div>
                  <div className="mono" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {z.id}
                  </div>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 4,
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
                    color: 'var(--color-accent)',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{inside.length}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)' }}>inside</span>
                </div>
              </div>
              <div style={{ margin: 'var(--space-3) 0' }}>
                <ZoneGlyph ring={z.ring} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {inside.length === 0 ? (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    No vehicles in this zone
                  </span>
                ) : (
                  inside.map((v) => (
                    <span
                      key={v.vehicleId}
                      className="mono"
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-control)',
                        background: 'var(--color-surface-alt)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {v.vehicleId}
                    </span>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
