import { DriverStatus, ErrorCode } from '@fleet/contracts';

import { validateDriverInput } from '../validation';
import { DomainError } from '../common/errors';
import { type Clock, systemClock, toIso } from '../common/clock';
import {
  type Driver,
  type DriverRepository,
  type DriverUpdate,
} from './driver-repository';
import {
  type DriverAvailabilityTarget,
  isDriverSettableTransition,
  isEligibleStatus,
} from './driver-status';

/** The create payload accepted by {@link DriverService.create}. */
export interface CreateDriverInput {
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
}

/** Generates unique ids; injectable so tests can produce stable values. */
export type IdGenerator = () => string;

export interface DriverServiceConfig {
  clock?: Clock;
  generateId?: IdGenerator;
}

let counter = 0;
const defaultIdGenerator: IdGenerator = () => {
  counter += 1;
  return `drv-${Date.now().toString(36)}-${counter}`;
};

export class DriverService {
  private readonly clock: Clock;
  private readonly generateId: IdGenerator;
  
  private readonly lastStamp = new Map<string, number>();

  constructor(
    private readonly repo: DriverRepository,
    config: DriverServiceConfig = {},
  ) {
    this.clock = config.clock ?? systemClock;
    this.generateId = config.generateId ?? defaultIdGenerator;
  }

  
  async create(input: CreateDriverInput): Promise<Driver> {
    const validationError = validateDriverInput(input);
    if (validationError) {
      throw new DomainError(validationError, 400);
    }

    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw DomainError.of(ErrorCode.Duplicate, ['email'], 409);
    }

    const now = this.nextStampFor(undefined);
    const iso = toIso(now);
    const driver: Driver = {
      id: this.generateId(),
      name: input.name,
      email: input.email,
      phone: input.phone,
      licenseNumber: input.licenseNumber,
      status: DriverStatus.Offline,
      active: true,
      createdAt: iso,
      updatedAt: iso,
    };
    this.lastStamp.set(driver.id, now);
    return this.repo.insert(driver);
  }

  
  async update(id: string, changes: DriverUpdate): Promise<Driver> {
    const current = await this.requireDriver(id);

    const next: Driver = {
      ...current,
      name: changes.name ?? current.name,
      phone: changes.phone ?? current.phone,
      licenseNumber: changes.licenseNumber ?? current.licenseNumber,
      status: changes.status ?? current.status,
      updatedAt: toIso(this.nextStampFor(current)),
    };
    return this.repo.save(next);
  }

  
  async deactivate(id: string): Promise<Driver> {
    const current = await this.requireDriver(id);
    const next: Driver = {
      ...current,
      active: false,
      updatedAt: toIso(this.nextStampFor(current)),
    };
    return this.repo.save(next);
  }

  
  list(status?: DriverStatus): Promise<Driver[]> {
    return this.repo.list(status);
  }

  
  async setAvailability(
    id: string,
    target: DriverAvailabilityTarget,
  ): Promise<Driver> {
    const current = await this.requireDriver(id);
    if (!isDriverSettableTransition(current.status, target)) {
      throw DomainError.of(ErrorCode.InvalidTransition, ['status'], 409);
    }
    const next: Driver = {
      ...current,
      status: target,
      updatedAt: toIso(this.nextStampFor(current)),
    };
    return this.repo.save(next);
  }

  
  async beginDelivery(id: string): Promise<Driver> {
    const current = await this.requireDriver(id);
    if (current.status !== DriverStatus.Available) {
      throw DomainError.of(ErrorCode.InvalidTransition, ['status'], 409);
    }
    const next: Driver = {
      ...current,
      status: DriverStatus.OnDelivery,
      updatedAt: toIso(this.nextStampFor(current)),
    };
    return this.repo.save(next);
  }

  
  async completeDelivery(id: string): Promise<Driver> {
    const current = await this.requireDriver(id);
    if (current.status !== DriverStatus.OnDelivery) {
      throw DomainError.of(ErrorCode.InvalidTransition, ['status'], 409);
    }
    const next: Driver = {
      ...current,
      status: DriverStatus.Available,
      updatedAt: toIso(this.nextStampFor(current)),
    };
    return this.repo.save(next);
  }

  
  static isEligibleForAssignment(driver: Driver): boolean {
    return driver.active && isEligibleStatus(driver.status);
  }

  private async requireDriver(id: string): Promise<Driver> {
    const driver = await this.repo.findById(id);
    if (!driver) {
      throw DomainError.of(ErrorCode.NotFound, ['id'], 404);
    }
    return driver;
  }

  
  private nextStampFor(current: Driver | undefined): number {
    const clockNow = this.clock.now();
    let floor = clockNow;
    if (current) {
      const prevTracked = this.lastStamp.get(current.id);
      const prevPersisted = Date.parse(current.updatedAt);
      floor = Math.max(
        clockNow,
        (prevTracked ?? Number.NEGATIVE_INFINITY) + 1,
        (Number.isNaN(prevPersisted) ? Number.NEGATIVE_INFINITY : prevPersisted) +
          1,
      );
      this.lastStamp.set(current.id, floor);
    }
    return floor;
  }
}
