import { type RouteStop } from '@fleet/contracts';

import { type GeoPoint } from '../deliveries';

/** Minimal delivery shape the route builder needs: an id and a destination. */
export interface RoutableDelivery {
  id: string;
  destination: GeoPoint;
}


export const OPTIMIZE_MIN_STOPS = 2;
export const OPTIMIZE_MAX_STOPS = 50;


export function isExactCover(
  sequence: readonly string[],
  expectedIds: readonly string[],
): boolean {
  if (sequence.length !== expectedIds.length) return false;
  const expected = new Set(expectedIds);
  const seen = new Set<string>();
  for (const id of sequence) {
    if (!expected.has(id)) return false; // foreign delivery
    if (seen.has(id)) return false; // duplicate
    seen.add(id);
  }
  return seen.size === expected.size; // covers every expected id
}


export function assignedOrderStops(
  deliveries: readonly RoutableDelivery[],
): RouteStop[] {
  return deliveries.map((d, index) => ({
    stopIndex: index,
    deliveryIds: [d.id],
    lat: d.destination.lat,
    lng: d.destination.lng,
  }));
}


export function optimizedStops(
  sequence: readonly string[],
  groups: readonly (readonly string[])[],
  deliveries: readonly RoutableDelivery[],
): RouteStop[] {
  const byId = new Map(deliveries.map((d) => [d.id, d]));

  // Map each delivery id to a stable group key (the group's first member).
  const groupKeyOf = new Map<string, string>();
  for (const group of groups) {
    const members = group.filter((id) => byId.has(id));
    if (members.length === 0) continue;
    const key = members[0];
    for (const id of members) groupKeyOf.set(id, key);
  }

  const stopByKey = new Map<string, RouteStop>();
  const stops: RouteStop[] = [];
  for (const id of sequence) {
    const delivery = byId.get(id);
    if (!delivery) continue; // defensive; validated callers never hit this
    const key = groupKeyOf.get(id) ?? id;
    const existing = stopByKey.get(key);
    if (existing) {
      if (!existing.deliveryIds.includes(id)) existing.deliveryIds.push(id);
      continue;
    }
    const stop: RouteStop = {
      stopIndex: stops.length,
      deliveryIds: [id],
      lat: delivery.destination.lat,
      lng: delivery.destination.lng,
    };
    stopByKey.set(key, stop);
    stops.push(stop);
  }
  return stops;
}
