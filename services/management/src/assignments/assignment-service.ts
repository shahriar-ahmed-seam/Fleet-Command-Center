import { AssignmentStatus, DriverStatus, ErrorCode } from '@fleet/contracts';

import { DomainError } from '../common/errors';
import { type Clock, systemClock, toIso } from '../common/clock';
import {
  type Driver,
  type DriverRepository,
  isEligibleStatus,
} from '../drivers';
import { type VehicleRepository } from '../vehicles';
import {
  type Delivery,
  type DeliveryRepository,
  DeliveryEvent,
  nextStatus,
} from '../deliveries';
import {
  type Assignment,
  type AssignmentRepository,
  isActiveAssignment,
} from './assignment-repository';

export interface AssignmentServiceConfig {
  clock?: Clock;
  generateId?: () => string;
}

let counter = 0;
const defaultIdGenerator = (): string => {
  counter += 1;
  return `asg-${Date.now().toString(36)}-${counter}`;
};

export class AssignmentService {
  private readonly clock: Clock;
  private readonly generateId: () => string;

  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly drivers: DriverRepository,
    private readonly vehicles: VehicleRepository,
    private readonly deliveries: DeliveryRepository,
    config: AssignmentServiceConfig = {},
  ) {
    this.clock = config.clock ?? systemClock;
    this.generateId = config.generateId ?? defaultIdGenerator;
  }

  
  async create(driverId: string, deliveryIds: string[]): Promise<Assignment> {
    if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      throw DomainError.of(ErrorCode.ValidationError, ['deliveryIds'], 400);
    }

    const driver = await this.requireEligibleDriver(driverId);

    const vehicle = await this.vehicles.findByDriverId(driverId);
    if (!vehicle) {
      throw DomainError.of(ErrorCode.Conflict, ['vehicleId'], 409);
    }

    const toLink = await this.resolveAssignableDeliveries(deliveryIds);

    const now = toIso(this.clock.now());
    const assignment: Assignment = {
      id: this.generateId(),
      driverId,
      vehicleId: vehicle.id,
      status: AssignmentStatus.Pending,
      createdAt: now,
    };
    await this.assignments.insert(assignment);

    for (const delivery of toLink) {
      const assigned = nextStatus(delivery.status, DeliveryEvent.Assign);
      await this.deliveries.save({
        ...delivery,
        assignmentId: assignment.id,
        status: assigned ?? delivery.status,
        updatedAt: now,
      });
    }

    await this.drivers.save({
      ...driver,
      status: DriverStatus.OnDelivery,
      updatedAt: now,
    });

    return assignment;
  }

  
  async accept(assignmentId: string): Promise<Assignment> {
    const assignment = await this.requireAssignment(assignmentId);
    const next: Assignment = {
      ...assignment,
      status: AssignmentStatus.Accepted,
      acceptedAt: assignment.acceptedAt ?? toIso(this.clock.now()),
    };
    return this.assignments.save(next);
  }

  
  async reassign(
    deliveryId: string,
    targetAssignmentId: string,
  ): Promise<Delivery> {
    const delivery = await this.deliveries.findById(deliveryId);
    if (!delivery) {
      throw DomainError.of(ErrorCode.NotFound, ['deliveryId'], 404);
    }
    if (!delivery.assignmentId) {
      // Not currently in an assignment — nothing to reassign.
      throw DomainError.of(ErrorCode.InvalidTransition, ['deliveryId'], 409);
    }
    if (delivery.assignmentId === targetAssignmentId) {
      return delivery; // Already there; no-op keeps it in exactly one.
    }

    const target = await this.requireAssignment(targetAssignmentId);
    if (!isActiveAssignment(target)) {
      throw DomainError.of(ErrorCode.Conflict, ['assignmentId'], 409);
    }

    const moved: Delivery = {
      ...delivery,
      assignmentId: target.id,
      updatedAt: toIso(this.clock.now()),
    };
    return this.deliveries.save(moved);
  }

  private async requireEligibleDriver(driverId: string): Promise<Driver> {
    const driver = await this.drivers.findById(driverId);
    if (!driver) {
      throw DomainError.of(ErrorCode.NotFound, ['driverId'], 404);
    }
    // Inactive or non-Available drivers cannot receive new assignments
    if (!driver.active || !isEligibleStatus(driver.status)) {
      throw DomainError.of(ErrorCode.UnavailableDriver, ['driverId'], 409);
    }
    return driver;
  }

  private async requireAssignment(id: string): Promise<Assignment> {
    const assignment = await this.assignments.findById(id);
    if (!assignment) {
      throw DomainError.of(ErrorCode.NotFound, ['assignmentId'], 404);
    }
    return assignment;
  }

  
  private async resolveAssignableDeliveries(
    deliveryIds: string[],
  ): Promise<Delivery[]> {
    const resolved: Delivery[] = [];
    for (const id of deliveryIds) {
      const delivery = await this.deliveries.findById(id);
      if (!delivery) {
        throw DomainError.of(ErrorCode.NotFound, ['deliveryId'], 404);
      }
      if (delivery.assignmentId) {
        throw DomainError.of(ErrorCode.AlreadyAssigned, ['deliveryId'], 409);
      }
      if (nextStatus(delivery.status, DeliveryEvent.Assign) === null) {
        // A non-Created delivery with no assignment cannot be assigned.
        throw DomainError.of(ErrorCode.AlreadyAssigned, ['deliveryId'], 409);
      }
      resolved.push(delivery);
    }
    return resolved;
  }
}
