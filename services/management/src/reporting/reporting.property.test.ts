import fc from 'fast-check';
import { DeliveryStatus } from '@fleet/contracts';

import { pbtParams, tag } from '../testing/pbt';
import {
  InMemoryDeliveryStatusHistoryRepository,
  type DeliveryStatusHistoryEntry,
} from './delivery-status-history-repository';
import {
  InMemoryLocationPingRepository,
  type LocationPing,
} from './location-ping-repository';
import { ReportingService } from './reporting-service';

const iso = (ms: number) => new Date(ms).toISOString();
const T0 = 1_700_000_000_000;

describe('reporting properties', () => {
  it(tag(40, 'Range queries return exactly the in-range pings in order'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            vehicleId: fc.constantFrom('veh-1', 'veh-2'),
            offset: fc.integer({ min: -5000, max: 15000 }),
          }),
          { minLength: 0, maxLength: 30 },
        ),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 5001, max: 10000 }),
        async (pings, fromOff, toOff) => {
          const pingRepo = new InMemoryLocationPingRepository();
          let i = 0;
          for (const p of pings) {
            const ping: LocationPing = {
              id: `p-${i++}`,
              vehicleId: p.vehicleId,
              lat: 1,
              lng: 2,
              timestamp: iso(T0 + p.offset),
            };
            await pingRepo.insert(ping);
          }
          const service = new ReportingService(
            new InMemoryDeliveryStatusHistoryRepository(),
            pingRepo,
          );

          const from = T0 + fromOff;
          const to = T0 + toOff;
          const track = await service.getVehicleTrack('veh-1', {
            from: iso(from),
            to: iso(to),
          });

          // Oracle: veh-1 pings within [from, to], chronological.
          const expected = pings
            .filter((p) => p.vehicleId === 'veh-1')
            .map((p) => T0 + p.offset)
            .filter((t) => t >= from && t <= to)
            .sort((a, b) => a - b);

          expect(track.map((p) => Date.parse(p.timestamp))).toEqual(expected);
        },
      ),
      pbtParams(),
    );
  });

  it(tag(40, 'Delivery history is isolated and chronologically ordered'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            deliveryId: fc.constantFrom('del-1', 'del-2'),
            offset: fc.integer({ min: 0, max: 10000 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        async (entries) => {
          const historyRepo = new InMemoryDeliveryStatusHistoryRepository();
          let i = 0;
          for (const e of entries) {
            const entry: DeliveryStatusHistoryEntry = {
              id: `h-${i++}`,
              deliveryId: e.deliveryId,
              fromStatus: null,
              toStatus: DeliveryStatus.Created,
              occurredAt: iso(T0 + e.offset),
            };
            await historyRepo.insert(entry);
          }
          const service = new ReportingService(
            historyRepo,
            new InMemoryLocationPingRepository(),
          );

          const history = await service.getDeliveryHistory('del-1');

          // Only del-1 entries, in non-decreasing time order.
          expect(history.every((h) => h.deliveryId === 'del-1')).toBe(true);
          const times = history.map((h) => Date.parse(h.occurredAt));
          const sorted = [...times].sort((a, b) => a - b);
          expect(times).toEqual(sorted);
          // Count matches the del-1 entries supplied.
          expect(history).toHaveLength(
            entries.filter((e) => e.deliveryId === 'del-1').length,
          );
        },
      ),
      pbtParams(),
    );
  });
});
