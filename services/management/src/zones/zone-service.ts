import { ErrorCode, makeError } from '@fleet/contracts';

import { isMissing, isValidVertexCount } from '../validation';
import { DomainError } from '../common/errors';
import { type Clock, systemClock, toIso } from '../common/clock';
import {
  type Ring,
  type ZoneGeometryValidator,
  distinctVertexCount,
} from './geometry';
import { type Zone, type ZoneRepository } from './zone-repository';


export const ZONE_NAME_MIN = 1;
export const ZONE_NAME_MAX = 100;
export const ARRIVAL_LABEL_MIN = 1;
export const ARRIVAL_LABEL_MAX = 100;

/** The create payload accepted by {@link ZoneService.create}. */
export interface CreateZoneInput {
  name: string;
  /** Closed exterior ring of `[lng, lat]` positions (first == last). */
  polygon: number[][];
  arrivalLabel?: string;
}

export interface ZoneServiceConfig {
  clock?: Clock;
  generateId?: () => string;
}

let counter = 0;
const defaultIdGenerator = (): string => {
  counter += 1;
  return `zone-${Date.now().toString(36)}-${counter}`;
};

export class ZoneService {
  private readonly clock: Clock;
  private readonly generateId: () => string;

  constructor(
    private readonly repo: ZoneRepository,
    private readonly geometry: ZoneGeometryValidator,
    config: ZoneServiceConfig = {},
  ) {
    this.clock = config.clock ?? systemClock;
    this.generateId = config.generateId ?? defaultIdGenerator;
  }

  
  async create(input: CreateZoneInput): Promise<Zone> {
    const fields: string[] = [];

    if (isMissing(input.name) || strLen(input.name) > ZONE_NAME_MAX) {
      fields.push('name');
    }
    if (
      input.arrivalLabel !== undefined &&
      input.arrivalLabel !== null &&
      (strLen(input.arrivalLabel) < ARRIVAL_LABEL_MIN ||
        strLen(input.arrivalLabel) > ARRIVAL_LABEL_MAX)
    ) {
      fields.push('arrivalLabel');
    }

    const ring = toRing(input.polygon);
    const geometryFieldInvalid = await this.isPolygonInvalid(ring);
    if (geometryFieldInvalid) {
      fields.push('polygon');
    }

    // A malformed/invalid polygon always pushes `polygon` onto `fields`, so the
    // `ring === null` arm is never reached on its own; including it narrows
    // `ring` to a non-null `Ring` for the persisted zone below.
    if (fields.length > 0 || ring === null) {
      throw new DomainError(makeError(ErrorCode.ValidationError, fields), 400);
    }

    const zone: Zone = {
      id: this.generateId(),
      name: input.name,
      polygon: ring,
      arrivalLabel: input.arrivalLabel ?? undefined,
      createdAt: toIso(this.clock.now()),
    };
    return this.repo.insert(zone);
  }

  
  private async isPolygonInvalid(ring: Ring | null): Promise<boolean> {
    if (!ring) return true;
    if (!isValidVertexCount(distinctVertexCount(ring))) return true;
    const { isClosed, isValid } = await this.geometry.check(ring);
    return !isClosed || !isValid;
  }
}

function strLen(value: unknown): number {
  return typeof value === 'string' ? value.length : 0;
}

/** Coerce raw input into a coordinate ring, or null when malformed. */
function toRing(polygon: unknown): Ring | null {
  if (!Array.isArray(polygon)) return null;
  const ring: [number, number][] = [];
  for (const pos of polygon) {
    if (
      !Array.isArray(pos) ||
      pos.length < 2 ||
      typeof pos[0] !== 'number' ||
      typeof pos[1] !== 'number' ||
      Number.isNaN(pos[0]) ||
      Number.isNaN(pos[1])
    ) {
      return null;
    }
    ring.push([pos[0], pos[1]]);
  }
  return ring;
}
