import {
  SocketEvent,
  ZoneEventType,
  type PositionEvent,
  type ZoneEventMessage,
} from '@fleet/contracts';

type LngLat = [number, number];

export interface SimZone {
  id: string;
  name: string;
  label: string;
  ring: LngLat[];
}

interface SimVehicleSpec {
  vehicleId: string;
  driverStatus: string;
  speed: number; // metres per second
  route: LngLat[];
}

interface SimVehicle extends SimVehicleSpec {
  segIndex: number;
  segFrac: number;
  lng: number;
  lat: number;
  heading: number;
  inside: Set<string>;
}

/** A simulator-emitted frame, shaped like a server→client socket message. */
export interface SimFrame {
  event: SocketEvent.Position | SocketEvent.ZoneEvent;
  payload: PositionEvent | ZoneEventMessage;
}

/** Zones the simulation tracks (aligned with the dashboard's seed zones). */
export const SIM_ZONES: SimZone[] = [
  {
    id: 'zone-dt',
    name: 'Downtown Core',
    label: 'Downtown Core',
    ring: [
      [-122.3415, 47.6125],
      [-122.3245, 47.6125],
      [-122.3245, 47.6005],
      [-122.3415, 47.6005],
      [-122.3415, 47.6125],
    ],
  },
  {
    id: 'zone-sodo',
    name: 'SODO Depot',
    label: 'SODO Depot',
    ring: [
      [-122.3389, 47.5985],
      [-122.3262, 47.5985],
      [-122.3262, 47.5905],
      [-122.3389, 47.5905],
      [-122.3389, 47.5985],
    ],
  },
];

// Looping delivery routes threaded through downtown Seattle so vehicles cross
// the geo-fenced zones and produce a steady stream of activity.
const ROUTES: Record<string, LngLat[]> = {
  'VAN-014': [
    [-122.3493, 47.6205],
    [-122.3415, 47.6135],
    [-122.3330, 47.6062],
    [-122.3300, 47.6010],
    [-122.3320, 47.5950],
    [-122.3380, 47.5930],
    [-122.3430, 47.6000],
    [-122.3470, 47.6110],
  ],
  'VAN-022': [
    [-122.3201, 47.6145],
    [-122.3289, 47.6175],
    [-122.3367, 47.6131],
    [-122.3321, 47.6062],
    [-122.3262, 47.6020],
    [-122.3245, 47.6090],
    [-122.3270, 47.6160],
  ],
  'TRK-003': [
    [-122.3316, 47.5905],
    [-122.3300, 47.5985],
    [-122.3340, 47.6040],
    [-122.3389, 47.5985],
    [-122.3360, 47.5920],
    [-122.3290, 47.5910],
  ],
  'VAN-031': [
    [-122.3140, 47.6180],
    [-122.3245, 47.6125],
    [-122.3331, 47.6097],
    [-122.3415, 47.6065],
    [-122.3360, 47.6135],
    [-122.3250, 47.6190],
  ],
  'VAN-045': [
    [-122.3550, 47.6090],
    [-122.3450, 47.6060],
    [-122.3360, 47.6030],
    [-122.3300, 47.5980],
    [-122.3380, 47.5950],
    [-122.3480, 47.6010],
  ],
};

const SPECS: SimVehicleSpec[] = [
  { vehicleId: 'VAN-014', driverStatus: 'On_Delivery', speed: 165, route: ROUTES['VAN-014'] },
  { vehicleId: 'VAN-022', driverStatus: 'Available', speed: 140, route: ROUTES['VAN-022'] },
  { vehicleId: 'TRK-003', driverStatus: 'On_Break', speed: 90, route: ROUTES['TRK-003'] },
  { vehicleId: 'VAN-031', driverStatus: 'On_Delivery', speed: 150, route: ROUTES['VAN-031'] },
  { vehicleId: 'VAN-045', driverStatus: 'On_Delivery', speed: 180, route: ROUTES['VAN-045'] },
];

const M_PER_DEG_LAT = 111_320;

function metresPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function segmentMetres(a: LngLat, b: LngLat): number {
  const lat = (a[1] + b[1]) / 2;
  const dx = (b[0] - a[0]) * metresPerDegLng(lat);
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

function bearing(a: LngLat, b: LngLat): number {
  const lat = (a[1] + b[1]) / 2;
  const dx = (b[0] - a[0]) * metresPerDegLng(lat);
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Even-odd ray casting; the closing point of the ring is ignored. */
function pointInRing(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  const n = ring.length - 1;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * A self-contained fleet simulation: vehicles move along looping routes,
 * emitting position updates and Enter/Exit zone events. It is the data source
 * behind simulation mode, so the dashboard is fully alive without a backend.
 */
export class FleetSimulation {
  private readonly vehicles: SimVehicle[];

  constructor() {
    this.vehicles = SPECS.map((s, i) => {
      const start = s.route[0];
      const next = s.route[1] ?? s.route[0];
      return {
        ...s,
        // Stagger starting positions so vehicles spread along their routes.
        segIndex: i % s.route.length,
        segFrac: (i * 0.17) % 1,
        lng: start[0],
        lat: start[1],
        heading: bearing(start, next),
        inside: new Set<string>(),
      };
    });
    // Seed initial zone membership without emitting spurious events.
    for (const v of this.vehicles) {
      for (const z of SIM_ZONES) {
        if (pointInRing(v.lng, v.lat, z.ring)) v.inside.add(z.id);
      }
    }
  }

  /** Advance the simulation by `dtMs` and return the frames produced. */
  tick(dtMs: number): SimFrame[] {
    const frames: SimFrame[] = [];
    const now = new Date().toISOString();

    for (const v of this.vehicles) {
      let remaining = v.speed * (dtMs / 1000);
      const route = v.route;

      // Walk along the polyline, consuming `remaining` metres.
      while (remaining > 0) {
        const a = route[v.segIndex];
        const b = route[(v.segIndex + 1) % route.length];
        const segLen = segmentMetres(a, b);
        const segRemainMetres = segLen * (1 - v.segFrac);
        if (remaining < segRemainMetres) {
          v.segFrac += remaining / segLen;
          remaining = 0;
        } else {
          remaining -= segRemainMetres;
          v.segIndex = (v.segIndex + 1) % route.length;
          v.segFrac = 0;
        }
        v.heading = bearing(a, b);
      }

      const a = route[v.segIndex];
      const b = route[(v.segIndex + 1) % route.length];
      v.lng = a[0] + (b[0] - a[0]) * v.segFrac;
      v.lat = a[1] + (b[1] - a[1]) * v.segFrac;

      frames.push({
        event: SocketEvent.Position,
        payload: {
          vehicleId: v.vehicleId,
          lat: v.lat,
          lng: v.lng,
          timestamp: now,
          telemetry: {
            heading: Math.round(v.heading),
            speed: Math.round(v.speed / 0.27778), // m/s → km/h-ish display
          },
        },
      });

      // Zone enter/exit detection.
      for (const z of SIM_ZONES) {
        const isIn = pointInRing(v.lng, v.lat, z.ring);
        const was = v.inside.has(z.id);
        if (isIn && !was) {
          v.inside.add(z.id);
          frames.push({
            event: SocketEvent.ZoneEvent,
            payload: {
              vehicleId: v.vehicleId,
              zoneId: z.id,
              type: ZoneEventType.Enter,
              label: z.label,
              timestamp: now,
            },
          });
        } else if (!isIn && was) {
          v.inside.delete(z.id);
          frames.push({
            event: SocketEvent.ZoneEvent,
            payload: {
              vehicleId: v.vehicleId,
              zoneId: z.id,
              type: ZoneEventType.Exit,
              label: z.label,
              timestamp: now,
            },
          });
        }
      }
    }

    return frames;
  }
}
