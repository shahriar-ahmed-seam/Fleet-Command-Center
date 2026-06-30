import fc from 'fast-check';
import { DeliveryStatus, DriverStatus } from '@fleet/contracts';

import { pbtParams, tag } from '../testing/pbt';
import { DomainError } from '../common/errors';
import { InMemoryDriverRepository, type Driver } from '../drivers';
import { InMemoryVehicleRepository, type Vehicle } from '../vehicles';
import { InMemoryDeliveryRepository, type Delivery } from '../deliveries';
import { AssignmentService, InMemoryAssignmentRepository } from './index';

interface Harness {
  service: AssignmentService;
  drivers: InMemoryDriverRepository;
  deliveries: InMemoryDeliveryRepository;
}

const now = () => new Date().toISOString();

function seedDriver(repo: InMemoryDriverRepository, status: DriverStatus, active: boolean): Promise<Driver> {
  return repo.insert({
    id: 'drv-1',
    name: 'D',
    email: 'd@example.com',
    phone: 'p',
    licenseNumber: 'l',
    status,
    active,
    createdAt: now(),
    updatedAt: now(),
  });
}

function seedVehicle(repo: InMemoryVehicleRepository, driverId: string): Promise<Vehicle> {
  return repo.insert({
    id: 'veh-1',
    identifier: 'VAN-1',
    type: 'van',
    capacityKg: 100,
    driverId,
    associatedAt: now(),
    createdAt: now(),
  });
}

function seedDelivery(repo: InMemoryDeliveryRepository, id: string): Promise<Delivery> {
  return repo.insert({
    id,
    address: '1 Main St',
    recipientName: 'R',
    recipientContact: 'c',
    weightKg: 1,
    destination: { lat: 0, lng: 0 },
    status: DeliveryStatus.Created,
    trackingToken: `trk-${id}`,
    createdAt: now(),
    updatedAt: now(),
  });
}

async function harness(
  driverStatus: DriverStatus,
  active: boolean,
  deliveryIds: string[],
): Promise<Harness> {
  const drivers = new InMemoryDriverRepository();
  const vehicles = new InMemoryVehicleRepository();
  const deliveries = new InMemoryDeliveryRepository();
  const assignments = new InMemoryAssignmentRepository();
  await seedDriver(drivers, driverStatus, active);
  await seedVehicle(vehicles, 'drv-1');
  for (const id of deliveryIds) await seedDelivery(deliveries, id);
  let n = 0;
  const service = new AssignmentService(assignments, drivers, vehicles, deliveries, {
    generateId: () => `asg-${(n += 1)}`,
  });
  return { service, drivers, deliveries };
}

const idList = fc.uniqueArray(
  fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0),
  { minLength: 1, maxLength: 5 },
);

describe('assignment properties', () => {
  it(tag(5, 'Deactivated and unavailable drivers cannot receive assignments'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          [DriverStatus.Offline, true] as const,
          [DriverStatus.OnBreak, true] as const,
          [DriverStatus.Available, false] as const,
        ),
        async ([status, active]) => {
          const { service } = await harness(status, active, ['d1']);
          await expect(service.create('drv-1', ['d1'])).rejects.toBeInstanceOf(
            DomainError,
          );
        },
      ),
      pbtParams(),
    );
  });

  it(tag(22, 'Assignment creation links deliveries to the available driver and vehicle'), async () => {
    await fc.assert(
      fc.asyncProperty(idList, async (ids) => {
        const { service, deliveries } = await harness(
          DriverStatus.Available,
          true,
          ids,
        );
        const assignment = await service.create('drv-1', ids);
        expect(assignment.driverId).toBe('drv-1');
        expect(assignment.vehicleId).toBe('veh-1');
        for (const id of ids) {
          const d = await deliveries.findById(id);
          expect(d?.assignmentId).toBe(assignment.id);
          expect(d?.status).toBe(DeliveryStatus.Assigned);
        }
      }),
      pbtParams(),
    );
  });

  it(tag(23, 'A delivery belongs to at most one active assignment'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0),
        async (id) => {
          const { service, deliveries } = await harness(
            DriverStatus.Available,
            true,
            [id],
          );
          await service.create('drv-1', [id]);
          // Re-assigning the same (now assigned) delivery is rejected.
          await expect(service.create('drv-1', [id])).rejects.toBeInstanceOf(
            DomainError,
          );
          const d = await deliveries.findById(id);
          expect(d?.assignmentId).toBeTruthy();
        },
      ),
      pbtParams(),
    );
  });

  it(tag(24, 'Assignment acceptance records its timestamp'), async () => {
    await fc.assert(
      fc.asyncProperty(idList, async (ids) => {
        const { service } = await harness(DriverStatus.Available, true, ids);
        const assignment = await service.create('drv-1', ids);
        const accepted = await service.accept(assignment.id);
        expect(accepted.acceptedAt).toBeTruthy();
        // Idempotent: first acceptance timestamp retained.
        const again = await service.accept(assignment.id);
        expect(again.acceptedAt).toBe(accepted.acceptedAt);
      }),
      pbtParams(),
    );
  });
});
