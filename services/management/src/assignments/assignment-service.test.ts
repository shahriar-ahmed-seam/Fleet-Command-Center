import {
  AssignmentStatus,
  DeliveryStatus,
  DriverStatus,
  ErrorCode,
} from '@fleet/contracts';

import { type Clock } from '../common/clock';
import {
  DriverService,
  InMemoryDriverRepository,
} from '../drivers';
import {
  VehicleService,
  InMemoryVehicleRepository,
} from '../vehicles';
import {
  InMemoryDeliveryRepository,
  type Delivery,
} from '../deliveries';
import {
  AssignmentService,
  InMemoryAssignmentRepository,
} from './index';

function fakeClock(start = 1_700_000_000_000): Clock & { advance(ms: number): void } {
  let ms = start;
  return {
    now: () => ms,
    advance: (d: number) => {
      ms += d;
    },
  };
}

interface Harness {
  clock: Clock & { advance(ms: number): void };
  driverRepo: InMemoryDriverRepository;
  vehicleRepo: InMemoryVehicleRepository;
  deliveryRepo: InMemoryDeliveryRepository;
  assignmentRepo: InMemoryAssignmentRepository;
  driverService: DriverService;
  vehicleService: VehicleService;
  service: AssignmentService;
}

function buildHarness(): Harness {
  const clock = fakeClock();
  const driverRepo = new InMemoryDriverRepository();
  const vehicleRepo = new InMemoryVehicleRepository();
  const deliveryRepo = new InMemoryDeliveryRepository();
  const assignmentRepo = new InMemoryAssignmentRepository();

  let dn = 0;
  let vn = 0;
  let an = 0;
  const driverService = new DriverService(driverRepo, {
    clock,
    generateId: () => `drv-${(dn += 1)}`,
  });
  const vehicleService = new VehicleService(vehicleRepo, {
    clock,
    generateId: () => `veh-${(vn += 1)}`,
  });
  const service = new AssignmentService(
    assignmentRepo,
    driverRepo,
    vehicleRepo,
    deliveryRepo,
    { clock, generateId: () => `asg-${(an += 1)}` },
  );
  return {
    clock,
    driverRepo,
    vehicleRepo,
    deliveryRepo,
    assignmentRepo,
    driverService,
    vehicleService,
    service,
  };
}

/** Create an Available, active driver associated with a fresh vehicle. */
async function availableDriverWithVehicle(
  h: Harness,
  email = 'd@fleet.test',
  identifier = 'VAN-1',
): Promise<string> {
  const driver = await h.driverService.create({
    name: 'Driver',
    email,
    phone: '555',
    licenseNumber: 'LIC',
  });
  await h.driverService.setAvailability(driver.id, DriverStatus.Available);
  const vehicle = await h.vehicleService.register({
    identifier,
    type: 'van',
    capacityKg: 1000,
  });
  await h.vehicleService.associateDriver(vehicle.id, driver.id);
  return driver.id;
}

/** Seed a delivery in a chosen status, optionally already assigned. */
async function seedDelivery(
  h: Harness,
  id: string,
  status: DeliveryStatus = DeliveryStatus.Created,
  assignmentId?: string,
): Promise<Delivery> {
  const now = new Date(1_699_000_000_000).toISOString();
  return h.deliveryRepo.insert({
    id,
    address: '1 Main St',
    recipientName: 'Pat',
    recipientContact: '555-0000',
    weightKg: 5,
    destination: { lat: 1, lng: 2 },
    status,
    trackingToken: `tok-${id}`,
    assignmentId,
    createdAt: now,
    updatedAt: now,
  });
}

describe('AssignmentService.create', () => {
  it('links deliveries to the driver and vehicle and marks them Assigned', async () => {
    const h = buildHarness();
    const driverId = await availableDriverWithVehicle(h);
    await seedDelivery(h, 'del-1');
    await seedDelivery(h, 'del-2');

    const assignment = await h.service.create(driverId, ['del-1', 'del-2']);
    expect(assignment.driverId).toBe(driverId);
    expect(assignment.vehicleId).toBe('veh-1');
    expect(assignment.status).toBe(AssignmentStatus.Pending);

    const linked = await h.deliveryRepo.listByAssignmentId(assignment.id);
    expect(linked.map((d) => d.id).sort()).toEqual(['del-1', 'del-2']);
    for (const d of linked) {
      expect(d.status).toBe(DeliveryStatus.Assigned);
    }

    const driver = (await h.driverRepo.findById(driverId))!;
    expect(driver.status).toBe(DriverStatus.OnDelivery);
  });

  it('rejects an Offline/On_Break driver with unavailable-driver', async () => {
    const h = buildHarness();
    const driver = await h.driverService.create({
      name: 'D',
      email: 'off@fleet.test',
      phone: '555',
      licenseNumber: 'LIC',
    });
    // Driver remains Offline by default.
    const vehicle = await h.vehicleService.register({
      identifier: 'VAN-9',
      type: 'van',
      capacityKg: 100,
    });
    await h.vehicleService.associateDriver(vehicle.id, driver.id);
    await seedDelivery(h, 'del-1');

    await expect(h.service.create(driver.id, ['del-1'])).rejects.toMatchObject({
      envelope: { error: ErrorCode.UnavailableDriver },
    });
    // Nothing assigned.
    expect((await h.deliveryRepo.findById('del-1'))?.assignmentId).toBeUndefined();
  });

  it('rejects a deactivated driver', async () => {
    const h = buildHarness();
    const driverId = await availableDriverWithVehicle(h);
    await h.driverService.deactivate(driverId);
    await seedDelivery(h, 'del-1');
    await expect(h.service.create(driverId, ['del-1'])).rejects.toMatchObject({
      envelope: { error: ErrorCode.UnavailableDriver },
    });
  });

  it('rejects an already-assigned delivery', async () => {
    const h = buildHarness();
    const driverId = await availableDriverWithVehicle(h);
    await seedDelivery(h, 'del-1', DeliveryStatus.Assigned, 'asg-existing');

    await expect(h.service.create(driverId, ['del-1'])).rejects.toMatchObject({
      envelope: { error: ErrorCode.AlreadyAssigned },
    });
  });

  it('rejects an empty delivery set', async () => {
    const h = buildHarness();
    const driverId = await availableDriverWithVehicle(h);
    await expect(h.service.create(driverId, [])).rejects.toMatchObject({
      envelope: { error: ErrorCode.ValidationError, fields: ['deliveryIds'] },
    });
  });

  it('persists no assignment when one delivery in the batch is invalid', async () => {
    const h = buildHarness();
    const driverId = await availableDriverWithVehicle(h);
    await seedDelivery(h, 'del-ok');
    await seedDelivery(h, 'del-bad', DeliveryStatus.Assigned, 'asg-existing');

    await expect(
      h.service.create(driverId, ['del-ok', 'del-bad']),
    ).rejects.toMatchObject({ envelope: { error: ErrorCode.AlreadyAssigned } });
    // The valid delivery is untouched and no assignment was created.
    expect((await h.deliveryRepo.findById('del-ok'))?.assignmentId).toBeUndefined();
    expect(await h.assignmentRepo.list()).toHaveLength(0);
  });
});

describe('AssignmentService.accept', () => {
  it('records the acceptance timestamp', async () => {
    const h = buildHarness();
    const driverId = await availableDriverWithVehicle(h);
    await seedDelivery(h, 'del-1');
    const assignment = await h.service.create(driverId, ['del-1']);

    h.clock.advance(4_000);
    const accepted = await h.service.accept(assignment.id);
    expect(accepted.status).toBe(AssignmentStatus.Accepted);
    expect(accepted.acceptedAt).toBe(new Date(1_700_000_004_000).toISOString());
  });
});

describe('AssignmentService.reassign', () => {
  it('moves a delivery from its assignment to another active assignment', async () => {
    const h = buildHarness();
    const driverA = await availableDriverWithVehicle(h, 'a@fleet.test', 'VAN-A');
    const driverB = await availableDriverWithVehicle(h, 'b@fleet.test', 'VAN-B');
    await seedDelivery(h, 'del-1');
    await seedDelivery(h, 'del-2');

    const asgA = await h.service.create(driverA, ['del-1']);
    const asgB = await h.service.create(driverB, ['del-2']);

    const moved = await h.service.reassign('del-1', asgB.id);
    expect(moved.assignmentId).toBe(asgB.id);

    expect(await h.deliveryRepo.listByAssignmentId(asgA.id)).toHaveLength(0);
    const inB = await h.deliveryRepo.listByAssignmentId(asgB.id);
    expect(inB.map((d) => d.id).sort()).toEqual(['del-1', 'del-2']);
  });

  it('rejects reassigning a delivery that is not in any assignment', async () => {
    const h = buildHarness();
    const driverId = await availableDriverWithVehicle(h);
    await seedDelivery(h, 'del-1');
    const asg = await h.service.create(driverId, ['del-1']);
    await seedDelivery(h, 'del-free');

    await expect(h.service.reassign('del-free', asg.id)).rejects.toMatchObject({
      envelope: { error: ErrorCode.InvalidTransition },
    });
  });
});
