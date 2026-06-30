import { DeliveryStatus } from '@fleet/contracts';

import {
  InMemoryDeliveryStatusHistoryRepository,
  type DeliveryStatusHistoryEntry,
} from './delivery-status-history-repository';
import {
  InMemoryLocationPingRepository,
  type LocationPing,
} from './location-ping-repository';
import { ReportingService } from './reporting-service';

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

let seq = 0;
function historyEntry(
  overrides: Partial<DeliveryStatusHistoryEntry> = {},
): DeliveryStatusHistoryEntry {
  seq += 1;
  return {
    id: `h-${seq}`,
    deliveryId: 'del-1',
    fromStatus: null,
    toStatus: DeliveryStatus.Created,
    occurredAt: iso(1_700_000_000_000),
    ...overrides,
  };
}

let pseq = 0;
function ping(overrides: Partial<LocationPing> = {}): LocationPing {
  pseq += 1;
  return {
    id: `p-${pseq}`,
    vehicleId: 'veh-1',
    lat: 1,
    lng: 2,
    timestamp: iso(1_700_000_000_000),
    ...overrides,
  };
}

async function setup(
  history: DeliveryStatusHistoryEntry[],
  pings: LocationPing[],
) {
  const historyRepo = new InMemoryDeliveryStatusHistoryRepository();
  const pingRepo = new InMemoryLocationPingRepository();
  for (const h of history) await historyRepo.insert(h);
  for (const p of pings) await pingRepo.insert(p);
  return new ReportingService(historyRepo, pingRepo);
}

describe('getDeliveryHistory', () => {
  it('returns a delivery transitions ordered chronologically', async () => {
    const t0 = 1_700_000_000_000;
    // Insert out of chronological order to prove the service sorts.
    const service = await setup(
      [
        historyEntry({
          deliveryId: 'del-1',
          fromStatus: DeliveryStatus.Assigned,
          toStatus: DeliveryStatus.InTransit,
          occurredAt: iso(t0 + 2000),
        }),
        historyEntry({
          deliveryId: 'del-1',
          fromStatus: null,
          toStatus: DeliveryStatus.Created,
          occurredAt: iso(t0),
        }),
        historyEntry({
          deliveryId: 'del-1',
          fromStatus: DeliveryStatus.Created,
          toStatus: DeliveryStatus.Assigned,
          occurredAt: iso(t0 + 1000),
        }),
        // A different delivery's entry must not leak in.
        historyEntry({ deliveryId: 'del-2', occurredAt: iso(t0 + 500) }),
      ],
      [],
    );

    const history = await service.getDeliveryHistory('del-1');

    expect(history.map((h) => h.toStatus)).toEqual([
      DeliveryStatus.Created,
      DeliveryStatus.Assigned,
      DeliveryStatus.InTransit,
    ]);
    expect(history.every((h) => h.deliveryId === 'del-1')).toBe(true);
  });

  it('returns an empty history for an unknown delivery', async () => {
    const service = await setup([historyEntry({ deliveryId: 'del-1' })], []);
    expect(await service.getDeliveryHistory('nope')).toEqual([]);
  });
});

describe('getVehicleTrack', () => {
  it('returns only in-range pings in chronological order', async () => {
    const t0 = 1_700_000_000_000;
    const service = await setup(
      [],
      [
        ping({ vehicleId: 'veh-1', timestamp: iso(t0 + 5000) }), // in range, latest
        ping({ vehicleId: 'veh-1', timestamp: iso(t0 - 1000) }), // before range
        ping({ vehicleId: 'veh-1', timestamp: iso(t0 + 1000) }), // in range
        ping({ vehicleId: 'veh-1', timestamp: iso(t0 + 9999) }), // after range
        ping({ vehicleId: 'veh-2', timestamp: iso(t0 + 1000) }), // other vehicle
      ],
    );

    const track = await service.getVehicleTrack('veh-1', {
      from: iso(t0),
      to: iso(t0 + 5000),
    });

    expect(track.map((p) => p.timestamp)).toEqual([
      iso(t0 + 1000),
      iso(t0 + 5000),
    ]);
  });

  it('includes pings exactly on the range boundaries (inclusive)', async () => {
    const t0 = 1_700_000_000_000;
    const service = await setup(
      [],
      [
        ping({ vehicleId: 'veh-1', timestamp: iso(t0) }), // == from
        ping({ vehicleId: 'veh-1', timestamp: iso(t0 + 1000) }), // == to
      ],
    );

    const track = await service.getVehicleTrack('veh-1', {
      from: iso(t0),
      to: iso(t0 + 1000),
    });

    expect(track).toHaveLength(2);
  });

  it('rejects an inverted range', async () => {
    const service = await setup([], []);
    await expect(
      service.getVehicleTrack('veh-1', {
        from: iso(2000),
        to: iso(1000),
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });
});

describe('getDeliverySummary', () => {
  it('counts Completed, Failed, and Cancelled terminal transitions in range', async () => {
    const t0 = 1_700_000_000_000;
    const service = await setup(
      [
        // Non-terminal transitions are ignored.
        historyEntry({ toStatus: DeliveryStatus.Created, occurredAt: iso(t0) }),
        historyEntry({
          toStatus: DeliveryStatus.InTransit,
          occurredAt: iso(t0 + 100),
        }),
        // Terminal transitions in range.
        historyEntry({
          deliveryId: 'd1',
          toStatus: DeliveryStatus.Completed,
          occurredAt: iso(t0 + 1000),
        }),
        historyEntry({
          deliveryId: 'd2',
          toStatus: DeliveryStatus.Completed,
          occurredAt: iso(t0 + 2000),
        }),
        historyEntry({
          deliveryId: 'd3',
          toStatus: DeliveryStatus.Failed,
          occurredAt: iso(t0 + 3000),
        }),
        historyEntry({
          deliveryId: 'd4',
          toStatus: DeliveryStatus.Cancelled,
          occurredAt: iso(t0 + 4000),
        }),
        // Terminal transition outside range (after `to`) is excluded.
        historyEntry({
          deliveryId: 'd5',
          toStatus: DeliveryStatus.Completed,
          occurredAt: iso(t0 + 99_999),
        }),
      ],
      [],
    );

    const summary = await service.getDeliverySummary({
      from: iso(t0),
      to: iso(t0 + 5000),
    });

    expect(summary).toEqual({ completed: 2, failed: 1, cancelled: 1 });
  });

  it('returns zero counts when no terminal transitions fall in range', async () => {
    const t0 = 1_700_000_000_000;
    const service = await setup(
      [
        historyEntry({
          toStatus: DeliveryStatus.Completed,
          occurredAt: iso(t0 - 10_000),
        }),
      ],
      [],
    );

    const summary = await service.getDeliverySummary({
      from: iso(t0),
      to: iso(t0 + 1000),
    });

    expect(summary).toEqual({ completed: 0, failed: 0, cancelled: 0 });
  });
});
