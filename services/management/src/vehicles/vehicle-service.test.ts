import { ErrorCode } from '@fleet/contracts';

import { DomainError } from '../common/errors';
import { type Clock } from '../common/clock';
import {
  VehicleService,
  InMemoryVehicleRepository,
  type RegisterVehicleInput,
} from './index';

const VALID: RegisterVehicleInput = {
  identifier: 'VAN-001',
  type: 'van',
  capacityKg: 1200,
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
  const repo = new InMemoryVehicleRepository();
  let n = 0;
  const service = new VehicleService(repo, {
    clock,
    generateId: () => `veh-${(n += 1)}`,
  });
  return { repo, service };
}

describe('VehicleService.register', () => {
  it('creates a vehicle with no driver association', async () => {
    const { service } = buildService();
    const vehicle = await service.register(VALID);
    expect(vehicle.identifier).toBe('VAN-001');
    expect(vehicle.capacityKg).toBe(1200);
    expect(vehicle.driverId).toBeUndefined();
    expect(vehicle.associatedAt).toBeUndefined();
    expect(vehicle.id).toBeTruthy();
  });

  it('rejects a missing identifier naming the field', async () => {
    const { service } = buildService();
    await expect(
      service.register({ ...VALID, identifier: '   ' }),
    ).rejects.toMatchObject({
      envelope: { error: ErrorCode.ValidationError, fields: ['identifier'] },
    });
  });

  it('rejects a duplicate identifier (case-insensitive)', async () => {
    const { service, repo } = buildService();
    await service.register(VALID);
    try {
      await service.register({ ...VALID, identifier: 'van-001' });
      fail('expected duplicate rejection');
    } catch (e) {
      const err = e as DomainError;
      expect(err.envelope.error).toBe(ErrorCode.Duplicate);
      expect(err.envelope.fields).toEqual(['identifier']);
      expect(err.httpStatus).toBe(409);
    }
    // Nothing extra persisted.
    expect(await repo.list()).toHaveLength(1);
  });
});

describe('VehicleService.associateDriver', () => {
  it('records the association and effective timestamp', async () => {
    const clock = fakeClock();
    const { service } = buildService(clock);
    const vehicle = await service.register(VALID);

    clock.advance(2_000);
    const associated = await service.associateDriver(vehicle.id, 'drv-1');
    expect(associated.driverId).toBe('drv-1');
    expect(associated.associatedAt).toBe(
      new Date(1_700_000_002_000).toISOString(),
    );
  });

  it('rejects associating a second, different driver', async () => {
    const { service } = buildService();
    const vehicle = await service.register(VALID);
    await service.associateDriver(vehicle.id, 'drv-1');

    try {
      await service.associateDriver(vehicle.id, 'drv-2');
      fail('expected conflict');
    } catch (e) {
      const err = e as DomainError;
      expect(err.envelope.error).toBe(ErrorCode.Conflict);
      expect(err.envelope.fields).toEqual(['driverId']);
      expect(err.httpStatus).toBe(409);
    }
    // The original association is unchanged.
    const after = (await service.list())[0];
    expect(after.driverId).toBe('drv-1');
  });

  it('is idempotent for the same driver and refreshes the timestamp', async () => {
    const clock = fakeClock();
    const { service } = buildService(clock);
    const vehicle = await service.register(VALID);
    const first = await service.associateDriver(vehicle.id, 'drv-1');

    clock.advance(5_000);
    const again = await service.associateDriver(vehicle.id, 'drv-1');
    expect(again.driverId).toBe('drv-1');
    expect(Date.parse(again.associatedAt!)).toBeGreaterThan(
      Date.parse(first.associatedAt!),
    );
  });

  it('rejects associating an unknown vehicle with not-found', async () => {
    const { service } = buildService();
    await expect(
      service.associateDriver('missing', 'drv-1'),
    ).rejects.toMatchObject({ envelope: { error: ErrorCode.NotFound } });
  });
});

describe('VehicleService.list', () => {
  it('returns every vehicle with its current driver association', async () => {
    const { service } = buildService();
    const a = await service.register(VALID);
    const b = await service.register({ ...VALID, identifier: 'VAN-002' });
    await service.associateDriver(a.id, 'drv-1');

    const all = await service.list();
    expect(all).toHaveLength(2);
    const byId = new Map(all.map((v) => [v.id, v]));
    expect(byId.get(a.id)?.driverId).toBe('drv-1');
    expect(byId.get(b.id)?.driverId).toBeUndefined();
  });
});
