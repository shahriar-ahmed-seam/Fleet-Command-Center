import { ErrorCode, makeError, type ErrorEnvelope } from '@fleet/contracts';

/** Inclusive coordinate and value bounds shared across validators. */
export const LAT_MIN = -90;
export const LAT_MAX = 90;
export const LNG_MIN = -180;
export const LNG_MAX = 180;
export const WEIGHT_MIN_EXCLUSIVE = 0;
export const WEIGHT_MAX = 1000;
export const ZONE_MIN_VERTICES = 3;
export const ZONE_MAX_VERTICES = 1000;


export function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
}

/** Latitude within [-90, 90]. */
export function isValidLatitude(value: unknown): boolean {
  return typeof value === 'number' && value >= LAT_MIN && value <= LAT_MAX;
}

/** Longitude within [-180, 180]. */
export function isValidLongitude(value: unknown): boolean {
  return typeof value === 'number' && value >= LNG_MIN && value <= LNG_MAX;
}

/** Package weight strictly greater than 0 and at most 1000 kg. */
export function isValidWeight(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    value > WEIGHT_MIN_EXCLUSIVE &&
    value <= WEIGHT_MAX
  );
}

/** Polygon vertex count within [3, 1000]. */
export function isValidVertexCount(count: unknown): boolean {
  return (
    typeof count === 'number' &&
    Number.isInteger(count) &&
    count >= ZONE_MIN_VERTICES &&
    count <= ZONE_MAX_VERTICES
  );
}

/**
 * Accumulates offending field names without duplicates, preserving the order
 * fields are first reported.
 */
class FieldCollector {
  private readonly seen = new Set<string>();
  readonly fields: string[] = [];

  add(field: string): void {
    if (!this.seen.has(field)) {
      this.seen.add(field);
      this.fields.push(field);
    }
  }

  /** A validation error envelope, or null when no fields were flagged. */
  toError(): ErrorEnvelope | null {
    return this.fields.length === 0
      ? null
      : makeError(ErrorCode.ValidationError, this.fields);
  }
}


export interface DriverInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  licenseNumber?: unknown;
}


export function validateDriverInput(input: DriverInput): ErrorEnvelope | null {
  const c = new FieldCollector();
  for (const field of ['name', 'email', 'phone', 'licenseNumber'] as const) {
    if (isMissing(input[field])) c.add(field);
  }
  return c.toError();
}


export interface PingInput {
  vehicleId?: unknown;
  lat?: unknown;
  lng?: unknown;
  timestamp?: unknown;
}


export function validatePingInput(input: PingInput): ErrorEnvelope | null {
  const c = new FieldCollector();
  for (const field of ['vehicleId', 'lat', 'lng', 'timestamp'] as const) {
    if (isMissing(input[field])) c.add(field);
  }
  if (!isMissing(input.lat) && !isValidLatitude(input.lat)) c.add('lat');
  if (!isMissing(input.lng) && !isValidLongitude(input.lng)) c.add('lng');
  return c.toError();
}


export interface DeliveryInput {
  address?: unknown;
  recipientName?: unknown;
  recipientContact?: unknown;
  weightKg?: unknown;
}


export function validateDeliveryInput(
  input: DeliveryInput,
): ErrorEnvelope | null {
  const c = new FieldCollector();
  for (const field of [
    'address',
    'recipientName',
    'recipientContact',
    'weightKg',
  ] as const) {
    if (isMissing(input[field])) c.add(field);
  }
  if (!isMissing(input.weightKg) && !isValidWeight(input.weightKg)) {
    c.add('weightKg');
  }
  return c.toError();
}


export interface ZoneInput {
  name?: unknown;
  /** The polygon's boundary vertices (outer ring). */
  vertices?: unknown;
}


export function validateZoneInput(input: ZoneInput): ErrorEnvelope | null {
  const c = new FieldCollector();
  if (isMissing(input.name)) c.add('name');

  const vertices = input.vertices;
  if (vertices === undefined || vertices === null) {
    c.add('vertices');
  } else if (!Array.isArray(vertices)) {
    c.add('vertices');
  } else if (!isValidVertexCount(vertices.length)) {
    c.add('vertices');
  }
  return c.toError();
}
