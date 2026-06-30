import fc from 'fast-check';
import {
  AssignmentStatus,
  DeliveryStatus,
  DriverStatus,
} from '@fleet/contracts';

import { pbtParams, tag } from '../testing/pbt';
import { InMemoryDriverRepository } from '../drivers';
import { InMemoryDeliveryRepository } from '../deliveries';
import { InMemoryAssignmentRepository } from '../assignments';
import {
  RouteService,
  InMemoryRouteRepository,
  RecordingRoutePublisher,
  type OptimizerClient,
  type OptimizeRequest,
  type OptimizeResponse,
} from './index';

const now = () => new Date().toISOString();

/** Optimizer stub whose behavior is selectable per test. */
type Mode = 'valid' | 'omit' | 'foreign' | 'duplicate' | 'timeout';

function stubOptimizer(mode: Mode): OptimizerClient {
  return {
    optimize(req: OptimizeRequest): Promise<OptimizeResponse> {
      const ids = req.stops.map((s) => s.deliveryId);
      switch (mode) {
        case 'valid':
          return Promise.resolve({ sequence: [...ids].reverse(), groups: [] });
        case 'omit':
          return Promise.resolve({ sequence: ids.slice(1), groups: [] });
        case 'foreign':
          return Promise.resolve({ sequence: [...ids, 'ghost'], groups: [] });
        case 'duplicate':
          return Promise.resolve({ sequence: [ids[0], ...ids], groups: [] });
        case 'timeout':
          return new Promise<OptimizeResponse>(() => {}); // never resolves
      }
    },
  };
}

async function buildHarness(deliveryCount: number, optimizer: OptimizerClient) {
  const routes = new InMemoryRouteRepository();
  const publisher = new RecordingRoutePublisher();
  const assignments = new InMemoryAssignmentRepository();
  const deliveries = new InMemoryDeliveryRepository();
  const drivers = new InMemoryDriverRepository();

  await drivers.insert({
    id: 'drv-1', name: 'D', email: 'd@e.com', phone: 'p', licenseNumber: 'l',
    status: DriverStatus.OnDelivery, active: true, createdAt: now(), updatedAt: now(),
  });
  await assignments.insert({
    id: 'asg-1', driverId: 'drv-1', vehicleId: 'veh-1',
    status: AssignmentStatus.Accepted, createdAt: now(),
  });
  for (let i = 0; i < deliveryCount; i++) {
    await deliveries.insert({
      id: `d${i}`, address: 'a', recipientName: 'R', recipientContact: 'c',
      weightKg: 1, destination: { lat: i * 0.01, lng: i * 0.01 },
      status: DeliveryStatus.Assigned, trackingToken: `t${i}`,
      assignmentId: 'asg-1', createdAt: now(), updatedAt: now(),
    });
  }

  const service = new RouteService(
    routes, optimizer, publisher, assignments, deliveries, drivers,
    async () => ({ lat: 0, lng: 0 }),
    { generateId: () => 'rte-1', optimizeTimeoutMs: 50 },
  );
  return { service, publisher, deliveries, drivers, assignments };
}

describe('route orchestration properties', () => {
  it(tag(25, 'Optimization is requested for 2-50 deliveries and falls back beyond the limit'), async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 60 }), async (count) => {
        const { service, publisher } = await buildHarness(count, stubOptimizer('valid'));
        const result = await service.createOrUpdateRoute('asg-1');
        if (count <= 50) {
          expect(result.overLimit).toBe(false);
          expect(result.route.optimized).toBe(true);
        } else {
          expect(result.overLimit).toBe(true);
          expect(result.route.optimized).toBe(false);
          expect(result.message).toBeDefined();
        }
        expect(publisher.published).toHaveLength(1);
      }),
      pbtParams(),
    );
  });

  it(tag(26, 'Route construction trusts only valid optimizer output'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<Mode>('valid', 'omit', 'foreign', 'duplicate', 'timeout'),
        async (mode) => {
          const { service } = await buildHarness(4, stubOptimizer(mode));
          const result = await service.createOrUpdateRoute('asg-1');
          // Only valid exact-cover output yields an optimized route.
          expect(result.route.optimized).toBe(mode === 'valid');
          // Every delivery appears exactly once across the stops regardless.
          const ids = result.route.stops.flatMap((s) => s.deliveryIds).sort();
          expect(ids).toEqual(['d0', 'd1', 'd2', 'd3']);
        },
      ),
      pbtParams(),
    );
  });

  it(tag(27, 'Changing the delivery set triggers re-optimization'), async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 6 }), async (extra) => {
        const { service, deliveries, publisher } = await buildHarness(3, stubOptimizer('valid'));
        await service.createOrUpdateRoute('asg-1');
        const firstPublishCount = publisher.published.length;

        // Add deliveries to the assignment, then re-optimize.
        for (let i = 0; i < extra; i++) {
          await deliveries.insert({
            id: `x${i}`, address: 'a', recipientName: 'R', recipientContact: 'c',
            weightKg: 1, destination: { lat: 1 + i, lng: 1 + i },
            status: DeliveryStatus.Assigned, trackingToken: `tx${i}`,
            assignmentId: 'asg-1', createdAt: now(), updatedAt: now(),
          });
        }
        const result = await service.reoptimize('asg-1');
        // The rebuilt route reflects the new delivery set and was republished.
        const ids = result.route.stops.flatMap((s) => s.deliveryIds);
        expect(ids).toHaveLength(3 + extra);
        expect(publisher.published.length).toBeGreaterThan(firstPublishCount);
      }),
      pbtParams(),
    );
  });

  it(tag(29, 'A route whose stops are all terminal completes the assignment and frees the driver'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(
          DeliveryStatus.Completed,
          DeliveryStatus.Failed,
          DeliveryStatus.Cancelled,
        ),
        async (count, terminal) => {
          const { service, deliveries, drivers, assignments } = await buildHarness(
            count,
            stubOptimizer('valid'),
          );
          // Drive every delivery to a terminal status.
          for (const d of await deliveries.listByAssignmentId('asg-1')) {
            await deliveries.save({ ...d, status: terminal });
          }
          const completed = await service.completeIfAllStopsTerminal('asg-1');
          expect(completed).toBe(true);
          expect((await assignments.findById('asg-1'))?.status).toBe(
            AssignmentStatus.Complete,
          );
          expect((await drivers.findById('drv-1'))?.status).toBe(
            DriverStatus.Available,
          );
        },
      ),
      pbtParams(),
    );
  });
});
