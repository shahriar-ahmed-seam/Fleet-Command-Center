import { ErrorCode } from '@fleet/contracts';

import { isMissing } from '../validation';
import { DomainError } from '../common/errors';
import { type Clock, systemClock, toIso } from '../common/clock';
import {
  type Vehicle,
  type VehicleRepository,
} from './vehicle-repository';

/** The registration payload accepted by {@link VehicleService.register}. */
export interface RegisterVehicleInput {
  identifier: string;
  type: string;
  capacityKg: number;
}

export interface VehicleServiceConfig {
  clock?: Clock;
  generateId?: () => string;
}

let counter = 0;
const defaultIdGenerator = (): string => {
  counter += 1;
  return `veh-${Date.now().toString(36)}-${counter}`;
};

export class VehicleService {
  private readonly clock: Clock;
  private readonly generateId: () => string;

  constructor(
    private readonly repo: VehicleRepository,
    config: VehicleServiceConfig = {},
  ) {
    this.clock = config.clock ?? systemClock;
    this.generateId = config.generateId ?? defaultIdGenerator;
  }

  
  async register(input: RegisterVehicleInput): Promise<Vehicle> {
    const fields: string[] = [];
    if (isMissing(input.identifier)) fields.push('identifier');
    if (isMissing(input.type)) fields.push('type');
    if (isMissing(input.capacityKg)) fields.push('capacityKg');
    if (fields.length > 0) {
      throw DomainError.of(ErrorCode.ValidationError, fields, 400);
    }

    const existing = await this.repo.findByIdentifier(input.identifier);
    if (existing) {
      throw DomainError.of(ErrorCode.Duplicate, ['identifier'], 409);
    }

    const vehicle: Vehicle = {
      id: this.generateId(),
      identifier: input.identifier,
      type: input.type,
      capacityKg: input.capacityKg,
      createdAt: toIso(this.clock.now()),
    };
    return this.repo.insert(vehicle);
  }

  
  async associateDriver(vehicleId: string, driverId: string): Promise<Vehicle> {
    if (isMissing(driverId)) {
      throw DomainError.of(ErrorCode.ValidationError, ['driverId'], 400);
    }
    const vehicle = await this.requireVehicle(vehicleId);

    if (vehicle.driverId && vehicle.driverId !== driverId) {
      throw DomainError.of(ErrorCode.Conflict, ['driverId'], 409);
    }

    const next: Vehicle = {
      ...vehicle,
      driverId,
      associatedAt: toIso(this.clock.now()),
    };
    return this.repo.save(next);
  }

  
  list(): Promise<Vehicle[]> {
    return this.repo.list();
  }

  private async requireVehicle(id: string): Promise<Vehicle> {
    const vehicle = await this.repo.findById(id);
    if (!vehicle) {
      throw DomainError.of(ErrorCode.NotFound, ['id'], 404);
    }
    return vehicle;
  }
}
