import { DeliveryStatus, ErrorCode } from '@fleet/contracts';

import { DomainError } from '../common/errors';
import { type Clock } from '../common/clock';
import {
  DeliveryService,
  InMemoryDeliveryRepository,
  DeliveryEvent,
  nextStatus,
  canTransition,
  isTerminal,
  type Delivery,
  type Geocoder,
  type GeoPoint,
} from './index';

const stubGeocoder: Geocoder = {
  geocode: (): Promise<GeoPoint> => Promise.resolve({ lat: 1, lng: 2 }),
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
  const repo = new InMemoryDeliveryRepository();
  let n = 0;
  const service = new DeliveryService(repo, stubGeocoder, {
    clock,
    generateId: () => `del-${(n += 1)}`,
    generateTrackingToken: () => `trk-${n}`,
  });
  return { repo, service };
}

/** Insert a delivery directly in a chosen status for transition tests. */
async function seed(
  repo: InMemoryDeliveryRepository,
  status: DeliveryStatus,
): Promise<Delivery> {
  const now = new Date(1_699_000_000_000).toISOString();
  return repo.insert({
    id: `seed-${status}`,
    address: '1 Main St',
    recipientName: 'Pat',
    recipientContact: '555-0000',
    weightKg: 10,
    destination: { lat: 1, lng: 2 },
    status,
    trackingToken: `tok-${status}`,
    createdAt: now,
    updatedAt: now,
  });
}

describe('transition table', () => {
  it('encodes exactly the defined transitions', () => {
    expect(nextStatus(DeliveryStatus.Created, DeliveryEvent.Assign)).toBe(
      DeliveryStatus.Assigned,
    );
    expect(nextStatus(DeliveryStatus.Created, DeliveryEvent.Cancel)).toBe(
      DeliveryStatus.Cancelled,
    );
    expect(nextStatus(DeliveryStatus.Assigned, DeliveryEvent.StartTransit)).toBe(
      DeliveryStatus.InTransit,
    );
    expect(nextStatus(DeliveryStatus.InTransit, DeliveryEvent.Arrive)).toBe(
      DeliveryStatus.Arrived,
    );
    expect(nextStatus(DeliveryStatus.Arrived, DeliveryEvent.Complete)).toBe(
      DeliveryStatus.Completed,
    );
    expect(nextStatus(DeliveryStatus.InTransit, DeliveryEvent.Fail)).toBe(
      DeliveryStatus.Failed,
    );
    expect(nextStatus(DeliveryStatus.Arrived, DeliveryEvent.Fail)).toBe(
      DeliveryStatus.Failed,
    );
  });

  it('permits cancellation from every non-terminal state', () => {
    for (const s of [
      DeliveryStatus.Created,
      DeliveryStatus.Assigned,
      DeliveryStatus.InTransit,
      DeliveryStatus.Arrived,
    ]) {
      expect(canTransition(s, DeliveryEvent.Cancel)).toBe(true);
    }
  });

  it('defines no transition out of a terminal state', () => {
    for (const s of [
      DeliveryStatus.Completed,
      DeliveryStatus.Failed,
      DeliveryStatus.Cancelled,
    ]) {
      expect(isTerminal(s)).toBe(true);
      for (const e of Object.values(DeliveryEvent)) {
        expect(nextStatus(s, e)).toBeNull();
      }
    }
  });

  it('rejects undefined transitions like Created -> Complete', () => {
    expect(nextStatus(DeliveryStatus.Created, DeliveryEvent.Complete)).toBeNull();
    expect(nextStatus(DeliveryStatus.Assigned, DeliveryEvent.Arrive)).toBeNull();
    expect(nextStatus(DeliveryStatus.Created, DeliveryEvent.StartTransit)).toBeNull();
  });
});

describe('DeliveryService.transition enforcement', () => {
  it('drives a delivery through the happy path to Completed', async () => {
    const { repo, service } = buildService(fakeClock());
    await seed(repo, DeliveryStatus.Created);

    let d = await service.transition('seed-Created', DeliveryEvent.Assign);
    expect(d.status).toBe(DeliveryStatus.Assigned);
    d = await service.transition('seed-Created', DeliveryEvent.StartTransit);
    expect(d.status).toBe(DeliveryStatus.InTransit);
    d = await service.transition('seed-Created', DeliveryEvent.Arrive);
    expect(d.status).toBe(DeliveryStatus.Arrived);
    d = await service.transition('seed-Created', DeliveryEvent.Complete);
    expect(d.status).toBe(DeliveryStatus.Completed);
  });

  it('records the completion timestamp on Complete', async () => {
    const clock = fakeClock();
    const { repo, service } = buildService(clock);
    await seed(repo, DeliveryStatus.Arrived);
    clock.advance(3_000);
    const completed = await service.transition(
      'seed-Arrived',
      DeliveryEvent.Complete,
    );
    expect(completed.completedAt).toBe(new Date(1_700_000_003_000).toISOString());
  });

  it('records the reason on Fail and requires 1–500 chars', async () => {
    const { repo, service } = buildService(fakeClock());
    await seed(repo, DeliveryStatus.InTransit);

    // Missing reason is a validation error and nothing changes.
    await expect(
      service.transition('seed-In_Transit', DeliveryEvent.Fail),
    ).rejects.toMatchObject({
      envelope: { error: ErrorCode.ValidationError, fields: ['reason'] },
    });
    const stillInTransit = await repo.findById('seed-In_Transit');
    expect(stillInTransit?.status).toBe(DeliveryStatus.InTransit);

    const failed = await service.transition('seed-In_Transit', DeliveryEvent.Fail, {
      reason: 'Recipient not available',
    });
    expect(failed.status).toBe(DeliveryStatus.Failed);
    expect(failed.failureReason).toBe('Recipient not available');
  });

  it('rejects a too-long failure reason (>500 chars)', async () => {
    const { repo, service } = buildService(fakeClock());
    await seed(repo, DeliveryStatus.Arrived);
    await expect(
      service.transition('seed-Arrived', DeliveryEvent.Fail, {
        reason: 'x'.repeat(501),
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects cancelling a terminal delivery and retains its status', async () => {
    const { repo, service } = buildService(fakeClock());
    await seed(repo, DeliveryStatus.Completed);
    await expect(
      service.transition('seed-Completed', DeliveryEvent.Cancel),
    ).rejects.toMatchObject({
      envelope: { error: ErrorCode.InvalidTransition },
    });
    const after = await repo.findById('seed-Completed');
    expect(after?.status).toBe(DeliveryStatus.Completed);
  });

  it('rejects an undefined transition and retains status', async () => {
    const { repo, service } = buildService(fakeClock());
    await seed(repo, DeliveryStatus.Created);
    await expect(
      service.transition('seed-Created', DeliveryEvent.Complete),
    ).rejects.toMatchObject({
      envelope: { error: ErrorCode.InvalidTransition },
    });
    const after = await repo.findById('seed-Created');
    expect(after?.status).toBe(DeliveryStatus.Created);
  });

  it('rejects transitioning an unknown delivery with not-found', async () => {
    const { service } = buildService(fakeClock());
    await expect(
      service.transition('missing', DeliveryEvent.Assign),
    ).rejects.toMatchObject({ envelope: { error: ErrorCode.NotFound } });
  });
});
