import {
  AssignmentStatus,
  DeliveryStatus,
  DriverStatus,
  ErrorCode,
} from '@fleet/contracts';

import { type Clock } from '../common/clock';
import {
  InMemoryDriverRepository,
  type Driver,
} from '../drivers';
import {
  InMemoryDeliveryRepository,
  type Delivery,
} from '../deliveries';
import {
  InMemoryAssignmentRepository,
  type Assignment,
} from '../assignments';
import {
  RouteService,
  InMemoryRouteRepository,
  RecordingRoutePublisher,
  isExactCover,
  type OptimizerClient,
  type OptimizeRequest,
  type OptimizeResponse,
} from './index';

function fakeClock(start = 1_700_000_000_000): Clock & { advance(ms: number): void } {
  let ms = start;
  return { now: () => ms, advance: (d: number) => { ms += d; } };
}

/** An optimizer stub that returns a fixed response (or a builder). */
function stubOptimizer(
  respond: (req: OptimizeRequest) => OptimizeResponse | Promise<OptimizeResponse>,
): OptimizerClient & { calls: OptimizeRequest[] } {
  const calls: OptimizeRequest[] = [];
  return {
    calls,
    optimize(req) {
      calls.push(req);
      return Promise.resolve(respond(req));
    },
  };
}

interface Harness {
  clock: Clock & { advance(ms: number): void };
  driverRepo: InMemoryDriverRepository;
  deliveryRepo: InMemoryDeliveryRepository;
  assignmentRepo: InMemoryAssignmentRepository;
  routeRepo: InMemoryRouteRepository;
  publisher: RecordingRoutePublisher;
}

function baseHarness(): Harness {
  return {
    clock: fakeClock(),
    driverRepo: new InMemoryDriverRepository(),
    deliveryRepo: new InMemoryDeliveryRepository(),
    assignmentRepo: new InMemoryAssignmentRepository(),
    routeRepo: new InMemoryRouteRepository(),
    publisher: new RecordingRoutePublisher(),
  };
}

function buildService(
  h: Harness,
  optimizer: OptimizerClient,
  opts: { timeoutMs?: number; origin?: { lat: number; lng: number } | null } = {},
): RouteService {
  const origin = opts.origin === undefined ? { lat: 0, lng: 0 } : opts.origin;
  let n = 0;
  return new RouteService(
    h.routeRepo,
    optimizer,
    h.publisher,
    h.assignmentRepo,
    h.deliveryRepo,
    h.driverRepo,
    () => Promise.resolve(origin),
    {
      clock: h.clock,
      generateId: () => `rte-${(n += 1)}`,
      optimizeTimeoutMs: opts.timeoutMs,
    },
  );
}

async function seedAssignment(
  h: Harness,
  deliveryCount: number,
  driverStatus: DriverStatus = DriverStatus.OnDelivery,
): Promise<Assignment> {
  const driver: Driver = {
    id: 'drv-1',
    name: 'D',
    email: 'd@fleet.test',
    phone: '5',
    licenseNumber: 'L',
    status: driverStatus,
    active: true,
    createdAt: new Date(1_699_000_000_000).toISOString(),
    updatedAt: new Date(1_699_000_000_000).toISOString(),
  };
  await h.driverRepo.insert(driver);

  const assignment: Assignment = {
    id: 'asg-1',
    driverId: 'drv-1',
    vehicleId: 'veh-1',
    status: AssignmentStatus.Accepted,
    createdAt: new Date(1_699_000_000_000).toISOString(),
  };
  await h.assignmentRepo.insert(assignment);

  for (let i = 0; i < deliveryCount; i += 1) {
    const d: Delivery = {
      id: `del-${i}`,
      address: `${i} St`,
      recipientName: 'R',
      recipientContact: '5',
      weightKg: 1,
      destination: { lat: i * 0.01, lng: i * 0.01 },
      status: DeliveryStatus.Assigned,
      trackingToken: `t-${i}`,
      assignmentId: 'asg-1',
      createdAt: new Date(1_699_000_000_000).toISOString(),
      updatedAt: new Date(1_699_000_000_000).toISOString(),
    };
    await h.deliveryRepo.insert(d);
  }
  return assignment;
}

describe('isExactCover', () => {
  it('accepts a permutation and rejects omission/foreign/duplicate', () => {
    expect(isExactCover(['a', 'b', 'c'], ['c', 'b', 'a'])).toBe(true);
    expect(isExactCover(['a', 'b'], ['a', 'b', 'c'])).toBe(false); // omission
    expect(isExactCover(['a', 'b', 'z'], ['a', 'b', 'c'])).toBe(false); // foreign
    expect(isExactCover(['a', 'a', 'b'], ['a', 'b', 'c'])).toBe(false); // duplicate
  });
});

describe('RouteService optimization request', () => {
  it('requests optimization for 2–50 deliveries and uses valid output', async () => {
    const h = baseHarness();
    await seedAssignment(h, 3);
    const optimizer = stubOptimizer(() => ({
      sequence: ['del-2', 'del-0', 'del-1'],
      groups: [],
    }));
    const service = buildService(h, optimizer);

    const result = await service.createOrUpdateRoute('asg-1');
    expect(optimizer.calls).toHaveLength(1);
    expect(optimizer.calls[0].origin).toEqual({ lat: 0, lng: 0 });
    expect(result.overLimit).toBe(false);
    expect(result.route.optimized).toBe(true);
    expect(result.route.stops.map((s) => s.deliveryIds[0])).toEqual([
      'del-2',
      'del-0',
      'del-1',
    ]);
  });

  it('groups co-located deliveries into a single stop', async () => {
    const h = baseHarness();
    await seedAssignment(h, 3);
    const optimizer = stubOptimizer(() => ({
      sequence: ['del-0', 'del-1', 'del-2'],
      groups: [['del-0', 'del-1']],
    }));
    const service = buildService(h, optimizer);
    const result = await service.createOrUpdateRoute('asg-1');

    expect(result.route.stops).toHaveLength(2);
    expect(result.route.stops[0].deliveryIds.sort()).toEqual(['del-0', 'del-1']);
    expect(result.route.stops[1].deliveryIds).toEqual(['del-2']);
  });
});

describe('RouteService fallback', () => {
  it('flags over-limit and uses assigned order beyond 50 deliveries', async () => {
    const h = baseHarness();
    await seedAssignment(h, 51);
    const optimizer = stubOptimizer(() => ({ sequence: [], groups: [] }));
    const service = buildService(h, optimizer);

    const result = await service.createOrUpdateRoute('asg-1');
    expect(optimizer.calls).toHaveLength(0); // never requested beyond the limit
    expect(result.overLimit).toBe(true);
    expect(result.message?.error).toBe(ErrorCode.OverLimit);
    expect(result.route.optimized).toBe(false);
    expect(result.route.stops).toHaveLength(51);
    expect(result.route.stops[0].deliveryIds).toEqual(['del-0']);
  });

  it('discards an omitted/foreign sequence and falls back', async () => {
    const h = baseHarness();
    await seedAssignment(h, 3);
    const optimizer = stubOptimizer(() => ({
      sequence: ['del-0', 'del-1'], // omits del-2
      groups: [],
    }));
    const service = buildService(h, optimizer);
    const result = await service.createOrUpdateRoute('asg-1');

    expect(result.route.optimized).toBe(false);
    expect(result.route.stops.map((s) => s.deliveryIds[0])).toEqual([
      'del-0',
      'del-1',
      'del-2',
    ]);
  });

  it('falls back on optimizer timeout', async () => {
    const h = baseHarness();
    await seedAssignment(h, 2);
    // Optimizer never resolves; the short timeout triggers the fallback.
    const optimizer: OptimizerClient = {
      optimize: () => new Promise<OptimizeResponse>(() => {}),
    };
    const service = buildService(h, optimizer, { timeoutMs: 20 });
    const result = await service.createOrUpdateRoute('asg-1');

    expect(result.route.optimized).toBe(false);
    expect(result.route.stops).toHaveLength(2);
  });

  it('falls back when no vehicle origin is available', async () => {
    const h = baseHarness();
    await seedAssignment(h, 2);
    const optimizer = stubOptimizer(() => ({ sequence: ['del-0', 'del-1'], groups: [] }));
    const service = buildService(h, optimizer, { origin: null });
    const result = await service.createOrUpdateRoute('asg-1');

    expect(optimizer.calls).toHaveLength(0);
    expect(result.route.optimized).toBe(false);
  });
});

describe('RouteService publish + re-optimize', () => {
  it('publishes the ordered route to the Driver_App', async () => {
    const h = baseHarness();
    await seedAssignment(h, 2);
    const optimizer = stubOptimizer(() => ({ sequence: ['del-0', 'del-1'], groups: [] }));
    const service = buildService(h, optimizer);
    await service.createOrUpdateRoute('asg-1');

    expect(h.publisher.published).toHaveLength(1);
    expect(h.publisher.published[0]).toMatchObject({
      assignmentId: 'asg-1',
      optimized: true,
    });
  });

  it('re-optimizes on delivery-set change, refreshing the route', async () => {
    const h = baseHarness();
    await seedAssignment(h, 2);
    let order = ['del-0', 'del-1'];
    const optimizer = stubOptimizer(() => ({ sequence: [...order], groups: [] }));
    const service = buildService(h, optimizer);

    const first = await service.createOrUpdateRoute('asg-1');
    // Delivery set changes: add a new delivery and re-optimize.
    await h.deliveryRepo.insert({
      id: 'del-2',
      address: '2 St',
      recipientName: 'R',
      recipientContact: '5',
      weightKg: 1,
      destination: { lat: 9, lng: 9 },
      status: DeliveryStatus.Assigned,
      trackingToken: 't-2',
      assignmentId: 'asg-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    order = ['del-2', 'del-0', 'del-1'];
    const second = await service.reoptimize('asg-1');

    expect(second.route.id).toBe(first.route.id); // same route record
    expect(second.route.optimized).toBe(true);
    expect(second.route.stops.map((s) => s.deliveryIds[0])).toEqual(order);
    expect(optimizer.calls).toHaveLength(2);
  });
});

describe('RouteService completion', () => {
  it('completes the assignment and frees the driver when all stops terminal', async () => {
    const h = baseHarness();
    await seedAssignment(h, 2, DriverStatus.OnDelivery);
    // Drive both deliveries to terminal statuses.
    for (const id of ['del-0', 'del-1']) {
      const d = (await h.deliveryRepo.findById(id))!;
      await h.deliveryRepo.save({ ...d, status: DeliveryStatus.Completed });
    }
    const optimizer = stubOptimizer(() => ({ sequence: [], groups: [] }));
    const service = buildService(h, optimizer);

    const completed = await service.completeIfAllStopsTerminal('asg-1');
    expect(completed).toBe(true);
    expect((await h.assignmentRepo.findById('asg-1'))?.status).toBe(
      AssignmentStatus.Complete,
    );
    expect((await h.driverRepo.findById('drv-1'))?.status).toBe(
      DriverStatus.Available,
    );
  });

  it('does not complete while a stop is still active', async () => {
    const h = baseHarness();
    await seedAssignment(h, 2, DriverStatus.OnDelivery);
    const d0 = (await h.deliveryRepo.findById('del-0'))!;
    await h.deliveryRepo.save({ ...d0, status: DeliveryStatus.Completed });
    // del-1 stays Assigned (non-terminal).
    const optimizer = stubOptimizer(() => ({ sequence: [], groups: [] }));
    const service = buildService(h, optimizer);

    const completed = await service.completeIfAllStopsTerminal('asg-1');
    expect(completed).toBe(false);
    expect((await h.assignmentRepo.findById('asg-1'))?.status).toBe(
      AssignmentStatus.Accepted,
    );
    expect((await h.driverRepo.findById('drv-1'))?.status).toBe(
      DriverStatus.OnDelivery,
    );
  });
});
