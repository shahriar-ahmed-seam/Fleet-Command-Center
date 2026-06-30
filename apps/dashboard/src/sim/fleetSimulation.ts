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

const M_PER_DEG_LAT = 111_320;
const metresPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function segmentMetres(a: LngLat, b: LngLat): number {
  const lat = (a[1] + b[1]) / 2;
  return Math.hypot((b[0] - a[0]) * metresPerDegLng(lat), (b[1] - a[1]) * M_PER_DEG_LAT);
}

function bearing(a: LngLat, b: LngLat): number {
  const lat = (a[1] + b[1]) / 2;
  const dx = (b[0] - a[0]) * metresPerDegLng(lat);
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function pointInRing(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  const n = ring.length - 1;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Smooth a closed loop of control points into a dense, road-like curve. */
function catmullRomClosed(pts: LngLat[], segments = 14): LngLat[] {
  const out: LngLat[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  return out;
}

/** Deterministic small PRNG so the fleet layout is stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build an irregular closed loop of control points around a centre. */
function makeLoop(center: LngLat, radiusDeg: number, points: number, rng: () => number): LngLat[] {
  const pts: LngLat[] = [];
  const latScale = 1 / Math.max(0.2, Math.cos((center[1] * Math.PI) / 180));
  for (let i = 0; i < points; i++) {
    const angle = (2 * Math.PI * i) / points + (rng() - 0.5) * 0.4;
    const r = radiusDeg * (0.55 + rng() * 0.9);
    pts.push([
      center[0] + Math.cos(angle) * r * latScale,
      center[1] + Math.sin(angle) * r,
    ]);
  }
  return pts;
}

const SEATTLE_ROUTES: Record<string, LngLat[]> = {
  'VAN-014': [
    [-122.3493, 47.6205], [-122.3415, 47.6135], [-122.3330, 47.6062],
    [-122.3300, 47.6010], [-122.3320, 47.5950], [-122.3380, 47.5930],
    [-122.3430, 47.6000], [-122.3470, 47.6110],
  ],
  'VAN-022': [
    [-122.3201, 47.6145], [-122.3289, 47.6175], [-122.3367, 47.6131],
    [-122.3321, 47.6062], [-122.3262, 47.6020], [-122.3245, 47.6090],
    [-122.3270, 47.6160],
  ],
  'TRK-003': [
    [-122.3316, 47.5905], [-122.3300, 47.5985], [-122.3340, 47.6040],
    [-122.3389, 47.5985], [-122.3360, 47.5920], [-122.3290, 47.5910],
  ],
  'VAN-031': [
    [-122.3140, 47.6180], [-122.3245, 47.6125], [-122.3331, 47.6097],
    [-122.3415, 47.6065], [-122.3360, 47.6135], [-122.3250, 47.6190],
  ],
  'VAN-045': [
    [-122.3550, 47.6090], [-122.3450, 47.6060], [-122.3360, 47.6030],
    [-122.3300, 47.5980], [-122.3380, 47.5950], [-122.3480, 47.6010],
  ],
};

// Regional fleets spread across the globe so the rotating earth always shows
// active trackers. Seattle keeps its hand-authored, zone-crossing routes.
const CITY_FLEETS: Array<{ prefix: string; center: LngLat; count: number; radius: number }> = [
  { prefix: 'NYC', center: [-74.006, 40.7128], count: 4, radius: 0.05 },
  { prefix: 'LDN', center: [-0.1276, 51.5072], count: 4, radius: 0.05 },
  { prefix: 'DXB', center: [55.2708, 25.2048], count: 3, radius: 0.06 },
  { prefix: 'SIN', center: [103.8198, 1.3521], count: 3, radius: 0.045 },
  { prefix: 'TYO', center: [139.6917, 35.6895], count: 4, radius: 0.05 },
  { prefix: 'SYD', center: [151.2093, -33.8688], count: 3, radius: 0.05 },
  { prefix: 'SAO', center: [-46.6333, -23.5505], count: 3, radius: 0.06 },
  { prefix: 'MEX', center: [-99.1332, 19.4326], count: 3, radius: 0.06 },
];

const STATUS_CYCLE = ['On_Delivery', 'On_Delivery', 'Available', 'On_Break'];

function buildSpecs(): SimVehicleSpec[] {
  const specs: SimVehicleSpec[] = [];

  const seattleStatus: Record<string, string> = {
    'VAN-014': 'On_Delivery', 'VAN-022': 'Available', 'TRK-003': 'On_Break',
    'VAN-031': 'On_Delivery', 'VAN-045': 'On_Delivery',
  };
  let i = 0;
  for (const [id, route] of Object.entries(SEATTLE_ROUTES)) {
    specs.push({
      vehicleId: id,
      driverStatus: seattleStatus[id],
      speed: 120 + (i % 4) * 22,
      route: catmullRomClosed(route, 16),
    });
    i++;
  }

  const rng = mulberry32(20260630);
  for (const fleet of CITY_FLEETS) {
    for (let v = 0; v < fleet.count; v++) {
      const loop = makeLoop(fleet.center, fleet.radius, 6 + Math.floor(rng() * 3), rng);
      specs.push({
        vehicleId: `${fleet.prefix}-${201 + v}`,
        driverStatus: STATUS_CYCLE[v % STATUS_CYCLE.length],
        speed: 70 + rng() * 120,
        route: catmullRomClosed(loop, 14),
      });
    }
  }
  return specs;
}

/**
 * A self-contained global fleet simulation: vehicles move along smoothed,
 * road-like loops in cities worldwide, emitting position updates and Enter/Exit
 * zone events. It is the data source behind simulation mode, so the dashboard
 * is fully alive without a backend.
 */
export class FleetSimulation {
  private readonly vehicles: SimVehicle[];

  constructor() {
    const specs = buildSpecs();
    const rng = mulberry32(987654321);
    this.vehicles = specs.map((s) => {
      const startIndex = Math.floor(rng() * s.route.length);
      const start = s.route[startIndex];
      const next = s.route[(startIndex + 1) % s.route.length];
      return {
        ...s,
        segIndex: startIndex,
        segFrac: rng(),
        lng: start[0],
        lat: start[1],
        heading: bearing(start, next),
        inside: new Set<string>(),
      };
    });
    for (const v of this.vehicles) {
      for (const z of SIM_ZONES) {
        if (pointInRing(v.lng, v.lat, z.ring)) v.inside.add(z.id);
      }
    }
  }

  tick(dtMs: number): SimFrame[] {
    const frames: SimFrame[] = [];
    const now = new Date().toISOString();

    for (const v of this.vehicles) {
      let remaining = v.speed * (dtMs / 1000);
      const route = v.route;

      while (remaining > 0) {
        const a = route[v.segIndex];
        const b = route[(v.segIndex + 1) % route.length];
        const segLen = segmentMetres(a, b) || 1;
        const segRemain = segLen * (1 - v.segFrac);
        if (remaining < segRemain) {
          v.segFrac += remaining / segLen;
          remaining = 0;
        } else {
          remaining -= segRemain;
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
            speed: Math.round(v.speed * 3.6),
          },
        },
      });

      for (const z of SIM_ZONES) {
        const isIn = pointInRing(v.lng, v.lat, z.ring);
        const was = v.inside.has(z.id);
        if (isIn && !was) {
          v.inside.add(z.id);
          frames.push({
            event: SocketEvent.ZoneEvent,
            payload: { vehicleId: v.vehicleId, zoneId: z.id, type: ZoneEventType.Enter, label: z.label, timestamp: now },
          });
        } else if (!isIn && was) {
          v.inside.delete(z.id);
          frames.push({
            event: SocketEvent.ZoneEvent,
            payload: { vehicleId: v.vehicleId, zoneId: z.id, type: ZoneEventType.Exit, label: z.label, timestamp: now },
          });
        }
      }
    }

    return frames;
  }
}
