import fc from 'fast-check';

import { DomainError } from '../common/errors';
import { pbtParams, tag } from '../testing/pbt';
import {
  VehicleService,
  InMemoryVehicleRepository,
  type RegisterVehicleInput,
} from './index';

const nonBlank = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

const vehicleInput = (): fc.Arbitrary<RegisterVehicleInput> =>
  fc.record({
    identifier: nonBlank,
    type: fc.constantFrom('van', 'truck', 'bike'),
    capacityKg: fc.integer({ min: 1, max: 5000 }),
  });

function build() {
  let n = 0;
  return new VehicleService(new InMemoryVehicleRepository(), {
    generateId: () => `veh-${(n += 1)}`,
  });
}

describe('vehicle management properties', () => {
  it(tag(3, 'Unique-key constraints reject duplicates'), async () => {
    await fc.assert(
      fc.asyncProperty(vehicleInput(), async (input) => {
        const service = build();
        await service.register(input);
        // Re-registering the same identifier is rejected; original unchanged.
        await expect(service.register(input)).rejects.toBeInstanceOf(DomainError);
        const all = await service.list();
        expect(all).toHaveLength(1);
      }),
      pbtParams(),
    );
  });

  it(tag(6, 'Listings return every vehicle with its driver association'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(nonBlank, { minLength: 1, maxLength: 8 }),
        async (identifiers) => {
          const service = build();
          for (const identifier of identifiers) {
            await service.register({ identifier, type: 'van', capacityKg: 100 });
          }
          const all = await service.list();
          expect(all).toHaveLength(identifiers.length);
          expect(new Set(all.map((v) => v.identifier))).toEqual(
            new Set(identifiers),
          );
          // Newly registered vehicles have no association yet.
          expect(all.every((v) => v.driverId === undefined)).toBe(true);
        },
      ),
      pbtParams(),
    );
  });

  it(tag(10, 'A vehicle has at most one active driver association'), async () => {
    await fc.assert(
      fc.asyncProperty(
        vehicleInput(),
        fc.tuple(nonBlank, nonBlank).filter(([a, b]) => a !== b),
        async (input, [driverA, driverB]) => {
          const service = build();
          const vehicle = await service.register(input);

          const associated = await service.associateDriver(vehicle.id, driverA);
          expect(associated.driverId).toBe(driverA);
          expect(associated.associatedAt).toBeTruthy();

          // A different driver is a conflict while one is active.
          await expect(
            service.associateDriver(vehicle.id, driverB),
          ).rejects.toBeInstanceOf(DomainError);

          // Re-associating the same driver is idempotent.
          const again = await service.associateDriver(vehicle.id, driverA);
          expect(again.driverId).toBe(driverA);
        },
      ),
      pbtParams(),
    );
  });
});
