import { DriverStatus, ErrorCode } from '@fleet/contracts';

import { DomainError } from '../common/errors';
import { type Clock } from '../common/clock';
import {
  DriverService,
  InMemoryDriverRepository,
  isDriverSettableTransition,
  isEligibleStatus,
  type CreateDriverInput,
} from './index';

const VALID: CreateDriverInput = {
  name: 'Grace Hopper',
  email: 'grace@fleet.test',
  phone: '555-0142',
  licenseNumber: 'LIC-042',
};

function fakeClock(start = 1_700_000_000_000): Clock & { advance(ms: number): void } {
  let ms = start;
  return {
    now: () => ms,
    advance: (d: number) => {
      ms += d;
    },
  };
}

function buildService(clock?: Clock) {
  const repo = new InMemoryDriverRepository();
  let n = 0;
  const service = new DriverService(repo, {
    clock,
    generateId: () => `drv-${(n += 1)}`,
  });
  return { repo, service };
}

/** Move a freshly-created (Offline) driver to a target availability state. */
async function driverInStatus(status: DriverStatus) {
  const { service } = buildService(fakeClock());
  const created = await service.create(VALID);
  if (status === DriverStatus.Offline) return { service, id: created.id };
  // All non-Offline states are reachable from Available.
  await service.setAvailability(created.id, DriverStatus.Available);
  if (status === DriverStatus.Available) return { service, id: created.id };
  if (status === DriverStatus.OnBreak) {
    await service.setAvailability(created.id, DriverStatus.OnBreak);
    return { service, id: created.id };
  }
  // On_Delivery is system-driven from Available.
  await service.beginDelivery(created.id);
  return { service, id: created.id };
}

describe('isDriverSettableTransition', () => {
  it('permits exactly the defined driver-initiated transitions', () => {
    expect(
      isDriverSettableTransition(DriverStatus.Offline, DriverStatus.Available),
    ).toBe(true);
    expect(
      isDriverSettableTransition(DriverStatus.Available, DriverStatus.OnBreak),
    ).toBe(true);
    expect(
      isDriverSettableTransition(DriverStatus.Available, DriverStatus.Offline),
    ).toBe(true);
    expect(
      isDriverSettableTransition(DriverStatus.OnBreak, DriverStatus.Available),
    ).toBe(true);
    expect(
      isDriverSettableTransition(DriverStatus.OnBreak, DriverStatus.Offline),
    ).toBe(true);
  });

  it('forbids selecting On_Delivery directly or leaving it manually', () => {
    expect(
      isDriverSettableTransition(DriverStatus.Available, DriverStatus.OnDelivery),
    ).toBe(false);
    expect(
      isDriverSettableTransition(DriverStatus.OnDelivery, DriverStatus.Available),
    ).toBe(false);
    expect(
      isDriverSettableTransition(DriverStatus.OnDelivery, DriverStatus.Offline),
    ).toBe(false);
  });

  it('forbids Offline -> On_Break (must go via Available)', () => {
    expect(
      isDriverSettableTransition(DriverStatus.Offline, DriverStatus.OnBreak),
    ).toBe(false);
  });
});

describe('DriverService.setAvailability', () => {
  it('sets Available and makes the driver eligible', async () => {
    const { service, id } = await driverInStatus(DriverStatus.Offline);
    const updated = await service.setAvailability(id, DriverStatus.Available);
    expect(updated.status).toBe(DriverStatus.Available);
    expect(DriverService.isEligibleForAssignment(updated)).toBe(true);
  });

  it('sets On_Break and excludes the driver from assignments', async () => {
    const { service, id } = await driverInStatus(DriverStatus.Available);
    const updated = await service.setAvailability(id, DriverStatus.OnBreak);
    expect(updated.status).toBe(DriverStatus.OnBreak);
    expect(DriverService.isEligibleForAssignment(updated)).toBe(false);
  });

  it('sets Offline and excludes the driver from assignments', async () => {
    const { service, id } = await driverInStatus(DriverStatus.Available);
    const updated = await service.setAvailability(id, DriverStatus.Offline);
    expect(updated.status).toBe(DriverStatus.Offline);
    expect(DriverService.isEligibleForAssignment(updated)).toBe(false);
  });

  it('advances updatedAt on a status change', async () => {
    const clock = fakeClock();
    const { service } = buildService(clock);
    const created = await service.create(VALID);
    clock.advance(1_000);
    const updated = await service.setAvailability(
      created.id,
      DriverStatus.Available,
    );
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(
      Date.parse(created.updatedAt),
    );
  });

  it('rejects an undefined transition and retains the current status', async () => {
    const { service, id } = await driverInStatus(DriverStatus.OnDelivery);
    await expect(
      service.setAvailability(id, DriverStatus.OnBreak),
    ).rejects.toMatchObject({ envelope: { error: ErrorCode.InvalidTransition } });
    const after = (await service.list()).find((d) => d.id === id);
    expect(after?.status).toBe(DriverStatus.OnDelivery);
  });
});

describe('DriverService system-driven On_Delivery', () => {
  it('moves an Available driver to On_Delivery while assigned', async () => {
    const { service, id } = await driverInStatus(DriverStatus.Available);
    const onDelivery = await service.beginDelivery(id);
    expect(onDelivery.status).toBe(DriverStatus.OnDelivery);
    // An On_Delivery driver is not eligible for a brand-new assignment.
    expect(DriverService.isEligibleForAssignment(onDelivery)).toBe(false);
  });

  it('frees the driver back to Available on completion', async () => {
    const { service, id } = await driverInStatus(DriverStatus.OnDelivery);
    const freed = await service.completeDelivery(id);
    expect(freed.status).toBe(DriverStatus.Available);
    expect(DriverService.isEligibleForAssignment(freed)).toBe(true);
  });

  it('refuses to begin a delivery for a non-Available driver', async () => {
    const { service, id } = await driverInStatus(DriverStatus.OnBreak);
    await expect(service.beginDelivery(id)).rejects.toBeInstanceOf(DomainError);
  });
});

describe('isEligibleStatus', () => {
  it('is true only for Available', () => {
    expect(isEligibleStatus(DriverStatus.Available)).toBe(true);
    expect(isEligibleStatus(DriverStatus.Offline)).toBe(false);
    expect(isEligibleStatus(DriverStatus.OnBreak)).toBe(false);
    expect(isEligibleStatus(DriverStatus.OnDelivery)).toBe(false);
  });

  it('a deactivated Available driver is still ineligible', async () => {
    const { service, id } = await driverInStatus(DriverStatus.Available);
    const deactivated = await service.deactivate(id);
    expect(deactivated.status).toBe(DriverStatus.Available);
    expect(DriverService.isEligibleForAssignment(deactivated)).toBe(false);
  });
});
