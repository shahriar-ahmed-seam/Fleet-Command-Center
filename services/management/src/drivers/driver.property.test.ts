import fc from 'fast-check';
import { DriverStatus } from '@fleet/contracts';

import { pbtParams, tag } from '../testing/pbt';
import {
  DriverService,
  InMemoryDriverRepository,
  type CreateDriverInput,
} from './index';

const nonBlank = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0);

const driverInput = (): fc.Arbitrary<CreateDriverInput> =>
  fc.record({
    name: nonBlank,
    email: nonBlank.map((s) => `${encodeURIComponent(s)}@example.com`),
    phone: nonBlank,
    licenseNumber: nonBlank,
  });

function build() {
  let n = 0;
  return new DriverService(new InMemoryDriverRepository(), {
    generateId: () => `drv-${(n += 1)}`,
  });
}

describe('driver management properties', () => {
  it(tag(1, 'Driver creation initializes to Offline'), async () => {
    await fc.assert(
      fc.asyncProperty(driverInput(), async (input) => {
        const driver = await build().create(input);
        expect(driver.status).toBe(DriverStatus.Offline);
        expect(driver.active).toBe(true);
      }),
      pbtParams(),
    );
  });

  it(tag(4, 'Updates persist and advance the update timestamp'), async () => {
    await fc.assert(
      fc.asyncProperty(driverInput(), nonBlank, async (input, newPhone) => {
        const service = build();
        const created = await service.create(input);
        const updated = await service.update(created.id, { phone: newPhone });
        expect(updated.phone).toBe(newPhone);
        expect(Date.parse(updated.updatedAt)).toBeGreaterThan(
          Date.parse(created.updatedAt),
        );
      }),
      pbtParams(),
    );
  });

  it(tag(9, 'Driver availability transitions reflect eligibility'), async () => {
    await fc.assert(
      fc.asyncProperty(driverInput(), async (input) => {
        const service = build();
        const created = await service.create(input);

        const available = await service.setAvailability(
          created.id,
          DriverStatus.Available,
        );
        expect(DriverService.isEligibleForAssignment(available)).toBe(true);

        const onBreak = await service.setAvailability(
          created.id,
          DriverStatus.OnBreak,
        );
        expect(DriverService.isEligibleForAssignment(onBreak)).toBe(false);

        // System-driven On_Delivery from Available.
        await service.setAvailability(created.id, DriverStatus.Available);
        const onDelivery = await service.beginDelivery(created.id);
        expect(onDelivery.status).toBe(DriverStatus.OnDelivery);
        expect(DriverService.isEligibleForAssignment(onDelivery)).toBe(false);
      }),
      pbtParams(),
    );
  });
});
