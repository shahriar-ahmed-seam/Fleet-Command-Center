import { DriverStatus, ErrorCode } from '@fleet/contracts';

import { DomainError } from '../common/errors';
import { type Clock } from '../common/clock';
import {
  DriverService,
  InMemoryDriverRepository,
  type CreateDriverInput,
} from './index';

const VALID: CreateDriverInput = {
  name: 'Ada Lovelace',
  email: 'ada@fleet.test',
  phone: '555-0100',
  licenseNumber: 'LIC-001',
};

/** A manually-advanced clock so timestamp assertions are deterministic. */
function fakeClock(start = 1_700_000_000_000): Clock & { advance(ms: number): void; set(ms: number): void } {
  let ms = start;
  return {
    now: () => ms,
    advance: (d: number) => {
      ms += d;
    },
    set: (v: number) => {
      ms = v;
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

describe('DriverService.create', () => {
  it('creates a driver defaulting to Offline and active', async () => {
    const { service } = buildService();
    const driver = await service.create(VALID);

    expect(driver.status).toBe(DriverStatus.Offline);
    expect(driver.active).toBe(true);
    expect(driver.id).toBeTruthy();
    expect(driver.createdAt).toBe(driver.updatedAt);
  });

  it('rejects missing required fields naming each one', async () => {
    const { service } = buildService();
    try {
      await service.create({ ...VALID, name: '   ', phone: '' });
      fail('expected create to reject');
    } catch (e) {
      const err = e as DomainError;
      expect(err).toBeInstanceOf(DomainError);
      expect(err.envelope.error).toBe(ErrorCode.ValidationError);
      expect(err.envelope.fields).toEqual(['name', 'phone']);
    }
  });

  it('rejects a duplicate email (case-insensitive)', async () => {
    const { service } = buildService();
    await service.create(VALID);
    try {
      await service.create({ ...VALID, email: 'ADA@fleet.test' });
      fail('expected duplicate rejection');
    } catch (e) {
      const err = e as DomainError;
      expect(err.envelope.error).toBe(ErrorCode.Duplicate);
      expect(err.envelope.fields).toEqual(['email']);
      expect(err.httpStatus).toBe(409);
    }
  });

  it('does not persist a rejected duplicate (only one driver remains)', async () => {
    const { service, repo } = buildService();
    await service.create(VALID);
    await expect(service.create(VALID)).rejects.toBeInstanceOf(DomainError);
    expect(await repo.list()).toHaveLength(1);
  });
});

describe('DriverService.update', () => {
  it('persists changes and strictly advances updatedAt', async () => {
    const clock = fakeClock();
    const { service } = buildService(clock);
    const created = await service.create(VALID);

    clock.advance(5_000);
    const updated = await service.update(created.id, {
      phone: '555-0199',
      status: DriverStatus.Available,
    });

    expect(updated.phone).toBe('555-0199');
    expect(updated.status).toBe(DriverStatus.Available);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(
      Date.parse(created.updatedAt),
    );
  });

  it('advances updatedAt even when the clock does not move', async () => {
    const clock = fakeClock();
    const { service } = buildService(clock);
    const created = await service.create(VALID);

    // No clock advance between updates.
    const first = await service.update(created.id, { phone: '1' });
    const second = await service.update(created.id, { phone: '2' });

    expect(Date.parse(first.updatedAt)).toBeGreaterThan(
      Date.parse(created.updatedAt),
    );
    expect(Date.parse(second.updatedAt)).toBeGreaterThan(
      Date.parse(first.updatedAt),
    );
  });

  it('rejects updating an unknown driver with not-found', async () => {
    const { service } = buildService();
    await expect(service.update('missing', { phone: '1' })).rejects.toThrow(
      DomainError,
    );
  });
});

describe('DriverService.deactivate', () => {
  it('marks the driver inactive and blocks new assignments', async () => {
    const { service } = buildService();
    const created = await service.create(VALID);
    // Even an otherwise-available driver becomes ineligible once inactive.
    const available = await service.update(created.id, {
      status: DriverStatus.Available,
    });
    expect(DriverService.isEligibleForAssignment(available)).toBe(true);

    const deactivated = await service.deactivate(created.id);
    expect(deactivated.active).toBe(false);
    expect(DriverService.isEligibleForAssignment(deactivated)).toBe(false);
  });
});

describe('DriverService.list', () => {
  it('returns exactly the drivers matching the status filter', async () => {
    const { service } = buildService();
    const a = await service.create(VALID);
    const b = await service.create({ ...VALID, email: 'b@fleet.test' });
    const c = await service.create({ ...VALID, email: 'c@fleet.test' });

    await service.update(a.id, { status: DriverStatus.Available });
    await service.update(b.id, { status: DriverStatus.Available });
    // c stays Offline

    const available = await service.list(DriverStatus.Available);
    const offline = await service.list(DriverStatus.Offline);

    expect(available.map((d) => d.id).sort()).toEqual([a.id, b.id].sort());
    expect(offline.map((d) => d.id)).toEqual([c.id]);
    expect(await service.list()).toHaveLength(3);
  });
});
