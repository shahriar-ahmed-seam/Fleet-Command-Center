import React from 'react';
import { SocketEvent, type PositionEvent } from '@fleet/contracts';
import { SocketClient } from '../realtime/socketClient';
import { TRACE_WINDOW_MS, type TracePing, type VehicleState } from './geo';
import { kindFromId } from './mapStyle';
import type { ZonePolygon } from './LiveMap';

/** Demo seed so the map is populated before live data flows. */
const SEED_VEHICLES: VehicleState[] = [
  { vehicleId: 'VAN-014', lat: 47.6062, lng: -122.3321, driverStatus: 'On_Delivery', heading: 45, label: 'VAN-014', kind: 'ground', active: true, zoneIds: ['zone-dt'] },
  { vehicleId: 'VAN-022', lat: 47.6205, lng: -122.3493, driverStatus: 'Available', heading: 200, label: 'VAN-022', kind: 'ground', active: true },
  { vehicleId: 'TRK-003', lat: 47.5952, lng: -122.3316, driverStatus: 'On_Break', heading: 310, label: 'TRK-003', kind: 'ground', active: true, zoneIds: ['zone-sodo'] },
  { vehicleId: 'VAN-031', lat: 47.6145, lng: -122.3201, driverStatus: 'On_Delivery', heading: 120, label: 'VAN-031', kind: 'ground', active: true },
];

const SEED_ZONES: ZonePolygon[] = [
  {
    id: 'zone-dt',
    name: 'Downtown Core',
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
    ring: [
      [-122.3389, 47.5985],
      [-122.3262, 47.5985],
      [-122.3262, 47.5905],
      [-122.3389, 47.5905],
      [-122.3389, 47.5985],
    ],
  },
];

function seedTraces(now: number): Record<string, TracePing[]> {
  // A short recent track for VAN-014 so selecting it shows a path immediately.
  const base = { lat: 47.6, lng: -122.34 };
  const pings: TracePing[] = [];
  for (let i = 12; i >= 0; i--) {
    pings.push({
      lat: base.lat + i * 0.0009 + Math.sin(i / 2) * 0.0004,
      lng: base.lng + i * 0.0011,
      timestamp: now - i * 4 * 60 * 1000, // every 4 minutes, within the last hour
    });
  }
  return { 'VAN-014': pings };
}

function bounded(pings: TracePing[], now: number): TracePing[] {
  const cutoff = now - TRACE_WINDOW_MS;
  const kept = pings.filter((p) => {
    const t = typeof p.timestamp === 'number' ? p.timestamp : new Date(p.timestamp).getTime();
    return t >= cutoff;
  });
  // Hard cap to keep memory bounded under sustained streaming.
  return kept.length > 2000 ? kept.slice(kept.length - 2000) : kept;
}

export interface FleetState {
  vehicles: VehicleState[];
  zones: ZonePolygon[];
  tracesByVehicle: Record<string, TracePing[]>;
}

/** Live fleet state derived from WebSocket position updates (with demo seed). */
export function useFleetState(client: SocketClient | null): FleetState {
  const [vehicles, setVehicles] = React.useState<Map<string, VehicleState>>(
    () => new Map(SEED_VEHICLES.map((v) => [v.vehicleId, v])),
  );
  const [traces, setTraces] = React.useState<Record<string, TracePing[]>>(() =>
    seedTraces(Date.now()),
  );

  React.useEffect(() => {
    if (!client) return;
    return client.on(SocketEvent.Position, (p: PositionEvent) => {
      setVehicles((prev) => {
        const next = new Map(prev);
        const existing = next.get(p.vehicleId);
        next.set(p.vehicleId, {
          vehicleId: p.vehicleId,
          lat: p.lat,
          lng: p.lng,
          heading: p.telemetry?.heading ?? existing?.heading ?? null,
          driverStatus: existing?.driverStatus ?? 'On_Delivery',
          label: existing?.label ?? p.vehicleId,
          kind: existing?.kind ?? kindFromId(p.vehicleId),
          active: true,
          zoneIds: existing?.zoneIds,
        });
        return next;
      });
      setTraces((prev) => {
        const now = Date.now();
        const arr = prev[p.vehicleId] ? [...prev[p.vehicleId]] : [];
        arr.push({ lat: p.lat, lng: p.lng, timestamp: p.timestamp });
        return { ...prev, [p.vehicleId]: bounded(arr, now) };
      });
    });
  }, [client]);

  const vehicleList = React.useMemo(() => [...vehicles.values()], [vehicles]);

  return { vehicles: vehicleList, zones: SEED_ZONES, tracesByVehicle: traces };
}
