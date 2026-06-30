/** A vehicle's live state on the map. */
export interface VehicleState {
  vehicleId: string;
  lat: number;
  lng: number;
  /** Driver_Status driving the marker color and the status filter. */
  driverStatus: string;
  heading?: number | null;
  /** Identifier label shown on the marker. */
  label?: string;
  /** Transport kind, driving the marker icon. */
  kind?: 'ground' | 'air' | 'sea';
  /** Zones the vehicle is currently inside (for the zone filter). */
  zoneIds?: string[];
  /** Whether the vehicle is active (rendered on the map by default). */
  active?: boolean;
}

/** A single position sample for a path trace. */
export interface TracePing {
  lat: number;
  lng: number;
  /** ISO-8601 or epoch-ms timestamp. */
  timestamp: string | number;
}


export const TRACE_WINDOW_MS = 60 * 60 * 1000;

function toEpoch(ts: string | number): number {
  return typeof ts === 'number' ? ts : new Date(ts).getTime();
}


export function windowTrace(
  pings: readonly TracePing[],
  now: number,
  windowMs: number = TRACE_WINDOW_MS,
): TracePing[] {
  const cutoff = now - windowMs;
  return pings
    .map((p) => ({ p, t: toEpoch(p.timestamp) }))
    .filter(({ t }) => Number.isFinite(t) && t >= cutoff && t <= now)
    .sort((a, b) => a.t - b.t)
    .map(({ p }) => p);
}


export interface MapFilter {
  /** Restrict to vehicles in this Driver_Status (null = any). */
  driverStatus?: string | null;
  /** Restrict to vehicles currently inside this zone (null = any). */
  zoneId?: string | null;
}


export function filterVehicles(
  vehicles: readonly VehicleState[],
  filter: MapFilter = {},
): VehicleState[] {
  return vehicles.filter((v) => {
    if (v.active === false) return false;
    if (filter.driverStatus && v.driverStatus !== filter.driverStatus) return false;
    if (filter.zoneId && !(v.zoneIds ?? []).includes(filter.zoneId)) return false;
    return true;
  });
}

/**
 * Web Mercator projection of lng/lat to normalized [0,1] world coordinates.
 * Used by the no-WebGL fallback renderer and tests; MapLibre handles its own
 * projection when the GL map is active.
 */
export function projectMercator(
  lng: number,
  lat: number,
): { x: number; y: number } {
  const x = (lng + 180) / 360;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((clampedLat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return { x, y };
}

/** Compute a bounding box [minLng, minLat, maxLng, maxLat] for points. */
export function boundsOf(
  points: readonly { lat: number; lng: number }[],
): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    minLng = Math.min(minLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLng = Math.max(maxLng, p.lng);
    maxLat = Math.max(maxLat, p.lat);
  }
  return [minLng, minLat, maxLng, maxLat];
}
