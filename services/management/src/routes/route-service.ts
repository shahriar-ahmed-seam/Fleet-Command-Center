import {
  AssignmentStatus,
  DriverStatus,
  ErrorCode,
  makeError,
  type ErrorEnvelope,
  type RouteUpdateEvent,
} from '@fleet/contracts';

import { DomainError } from '../common/errors';
import { type Clock, systemClock, toIso } from '../common/clock';
import {
  type GeoPoint,
  type DeliveryRepository,
  isTerminal,
  withTimeout,
} from '../deliveries';
import { type DriverRepository } from '../drivers';
import {
  type AssignmentRepository,
  type Assignment,
} from '../assignments';
import { type Route, type RouteRepository } from './route-repository';
import { type OptimizerClient } from './optimizer-client';
import { type RoutePublisher } from './route-publisher';
import {
  type RoutableDelivery,
  OPTIMIZE_MAX_STOPS,
  OPTIMIZE_MIN_STOPS,
  assignedOrderStops,
  isExactCover,
  optimizedStops,
} from './route-builder';


export const OPTIMIZE_TIMEOUT_MS = 30_000;

/** Resolves a vehicle's current location to use as the optimization origin. */
export type VehicleLocationProvider = (
  vehicleId: string,
) => Promise<GeoPoint | null>;

/** The outcome of building/updating a route. */
export interface RouteResult {
  route: Route;
  
  overLimit: boolean;
  /** Over-limit message surfaced to the dispatcher, present iff `overLimit`. */
  message?: ErrorEnvelope;
}

export interface RouteServiceConfig {
  clock?: Clock;
  generateId?: () => string;
  optimizeTimeoutMs?: number;
}

let counter = 0;
const defaultIdGenerator = (): string => {
  counter += 1;
  return `rte-${Date.now().toString(36)}-${counter}`;
};

export class RouteService {
  private readonly clock: Clock;
  private readonly generateId: () => string;
  private readonly optimizeTimeoutMs: number;

  constructor(
    private readonly routes: RouteRepository,
    private readonly optimizer: OptimizerClient,
    private readonly publisher: RoutePublisher,
    private readonly assignments: AssignmentRepository,
    private readonly deliveries: DeliveryRepository,
    private readonly drivers: DriverRepository,
    private readonly locationProvider: VehicleLocationProvider,
    config: RouteServiceConfig = {},
  ) {
    this.clock = config.clock ?? systemClock;
    this.generateId = config.generateId ?? defaultIdGenerator;
    this.optimizeTimeoutMs = config.optimizeTimeoutMs ?? OPTIMIZE_TIMEOUT_MS;
  }

  /**
   * Build (or rebuild) the route for an assignment, requesting optimization
   * when eligible and falling back as required, then persist and publish it.
   */
  async createOrUpdateRoute(assignmentId: string): Promise<RouteResult> {
    const assignment = await this.requireAssignment(assignmentId);
    const deliveries = await this.deliveries.listByAssignmentId(assignmentId);
    const routable: RoutableDelivery[] = deliveries.map((d) => ({
      id: d.id,
      destination: d.destination,
    }));

    const built = await this.buildStops(assignment, routable);

    const now = toIso(this.clock.now());
    const existing = await this.routes.findByAssignmentId(assignmentId);
    const route: Route = {
      id: existing?.id ?? this.generateId(),
      assignmentId,
      stops: built.stops,
      optimized: built.optimized,
      currentStop: 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const saved = await this.routes.upsert(route);

    const event: RouteUpdateEvent = {
      assignmentId,
      stops: saved.stops,
      optimized: saved.optimized,
    };
    await this.publisher.publishRoute(event);

    return {
      route: saved,
      overLimit: built.overLimit,
      message: built.overLimit ? makeError(ErrorCode.OverLimit) : undefined,
    };
  }

  
  reoptimize(assignmentId: string): Promise<RouteResult> {
    return this.createOrUpdateRoute(assignmentId);
  }

  
  async completeIfAllStopsTerminal(assignmentId: string): Promise<boolean> {
    const assignment = await this.requireAssignment(assignmentId);
    const deliveries = await this.deliveries.listByAssignmentId(assignmentId);
    if (deliveries.length === 0) return false;
    if (!deliveries.every((d) => isTerminal(d.status))) return false;

    const now = toIso(this.clock.now());
    await this.assignments.save({
      ...assignment,
      status: AssignmentStatus.Complete,
    });

    const driver = await this.drivers.findById(assignment.driverId);
    if (driver && driver.status === DriverStatus.OnDelivery) {
      await this.drivers.save({
        ...driver,
        status: DriverStatus.Available,
        updatedAt: now,
      });
    }
    return true;
  }

  /**
   * Decide the route's stops and optimized flag. Requests optimization only for
   * 2–50 deliveries; otherwise builds the assigned-order route directly.
   */
  private async buildStops(
    assignment: Assignment,
    routable: RoutableDelivery[],
  ): Promise<{ stops: ReturnType<typeof assignedOrderStops>; optimized: boolean; overLimit: boolean }> {
    const count = routable.length;

    if (count > OPTIMIZE_MAX_STOPS) {
      return { stops: assignedOrderStops(routable), optimized: false, overLimit: true };
    }

    if (count < OPTIMIZE_MIN_STOPS) {
      // 0–1 deliveries need no optimization; the assigned order is optimal.
      return { stops: assignedOrderStops(routable), optimized: true, overLimit: false };
    }

    const expectedIds = routable.map((d) => d.id);
    try {
      const origin = await this.locationProvider(assignment.vehicleId);
      if (!origin) throw new Error('no vehicle origin available');

      const response = await withTimeout(
        this.optimizer.optimize({
          origin,
          stops: routable.map((d) => ({
            deliveryId: d.id,
            lat: d.destination.lat,
            lng: d.destination.lng,
          })),
        }),
        this.optimizeTimeoutMs,
      );

      if (isExactCover(response.sequence, expectedIds)) {
        return {
          stops: optimizedStops(response.sequence, response.groups ?? [], routable),
          optimized: true,
          overLimit: false,
        };
      }
    } catch {
    }

    return { stops: assignedOrderStops(routable), optimized: false, overLimit: false };
  }

  private async requireAssignment(id: string): Promise<Assignment> {
    const assignment = await this.assignments.findById(id);
    if (!assignment) {
      throw DomainError.of(ErrorCode.NotFound, ['assignmentId'], 404);
    }
    return assignment;
  }
}
