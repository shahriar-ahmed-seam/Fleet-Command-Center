import { DeliveryStatus, ErrorCode } from '@fleet/contracts';

import { validateDeliveryInput } from '../validation';
import { DomainError } from '../common/errors';
import { type Clock, systemClock, toIso } from '../common/clock';
import { type Geocoder, withTimeout } from './geocoder';
import {
  type Delivery,
  type DeliveryRepository,
} from './delivery-repository';
import {
  DeliveryEvent,
  isValidFailureReason,
  nextStatus,
} from './delivery-lifecycle';


export const GEOCODE_TIMEOUT_MS = 10_000;

/** The create payload accepted by {@link DeliveryService.create}. */
export interface CreateDeliveryInput {
  address: string;
  recipientName: string;
  recipientContact: string;
  weightKg: number;
}

export interface DeliveryServiceConfig {
  clock?: Clock;
  generateId?: () => string;
  generateTrackingToken?: () => string;
  
  geocodeTimeoutMs?: number;
}

let idCounter = 0;
let tokenCounter = 0;
const defaultIdGenerator = (): string => {
  idCounter += 1;
  return `del-${Date.now().toString(36)}-${idCounter}`;
};
const defaultTokenGenerator = (): string => {
  tokenCounter += 1;
  return `trk-${Date.now().toString(36)}-${tokenCounter}`;
};

export class DeliveryService {
  private readonly clock: Clock;
  private readonly generateId: () => string;
  private readonly generateTrackingToken: () => string;
  private readonly geocodeTimeoutMs: number;

  constructor(
    private readonly repo: DeliveryRepository,
    private readonly geocoder: Geocoder,
    config: DeliveryServiceConfig = {},
  ) {
    this.clock = config.clock ?? systemClock;
    this.generateId = config.generateId ?? defaultIdGenerator;
    this.generateTrackingToken =
      config.generateTrackingToken ?? defaultTokenGenerator;
    this.geocodeTimeoutMs = config.geocodeTimeoutMs ?? GEOCODE_TIMEOUT_MS;
  }

  
  async create(input: CreateDeliveryInput): Promise<Delivery> {
    const validationError = validateDeliveryInput(input);
    if (validationError) {
      throw new DomainError(validationError, 400);
    }

    let destination;
    try {
      destination = await withTimeout(
        this.geocoder.geocode(input.address),
        this.geocodeTimeoutMs,
      );
    } catch {
      // Both an explicit geocoder rejection and a timeout map to the same
      // client-facing geocoding-failure response; nothing is persisted.
      throw DomainError.of(ErrorCode.GeocodingFailure, ['address'], 422);
    }

    const iso = toIso(this.clock.now());
    const delivery: Delivery = {
      id: this.generateId(),
      address: input.address,
      recipientName: input.recipientName,
      recipientContact: input.recipientContact,
      weightKg: input.weightKg,
      destination,
      status: DeliveryStatus.Created,
      trackingToken: this.generateTrackingToken(),
      createdAt: iso,
      updatedAt: iso,
    };
    return this.repo.insert(delivery);
  }

  
  async transition(
    id: string,
    event: DeliveryEvent,
    options: { reason?: string } = {},
  ): Promise<Delivery> {
    const current = await this.repo.findById(id);
    if (!current) {
      throw DomainError.of(ErrorCode.NotFound, ['id'], 404);
    }

    const target = nextStatus(current.status, event);
    if (target === null) {
      // Undefined or terminal-state transition: reject, retain status.
      throw DomainError.of(ErrorCode.InvalidTransition, ['status'], 409);
    }

    if (event === DeliveryEvent.Fail && !isValidFailureReason(options.reason)) {
      throw DomainError.of(ErrorCode.ValidationError, ['reason'], 400);
    }

    const iso = toIso(this.clock.now());
    const next: Delivery = {
      ...current,
      status: target,
      updatedAt: iso,
    };
    if (target === DeliveryStatus.Completed) {
      next.completedAt = iso; // Req 7.7
    }
    if (target === DeliveryStatus.Failed) {
      next.failureReason = options.reason; // Req 7.8 (validated above)
    }
    return this.repo.save(next);
  }
}
