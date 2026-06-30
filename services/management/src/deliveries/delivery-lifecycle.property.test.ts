import fc from 'fast-check';
import { DeliveryStatus } from '@fleet/contracts';

import { pbtParams, tag } from '../testing/pbt';
import { DomainError } from '../common/errors';
import {
  DeliveryService,
  InMemoryDeliveryRepository,
  DeliveryEvent,
  nextStatus,
  type Delivery,
} from './index';

function seedDelivery(
  repo: InMemoryDeliveryRepository,
  status: DeliveryStatus,
): Promise<Delivery> {
  const now = new Date().toISOString();
  return repo.insert({
    id: `del-${Math.random().toString(36).slice(2)}`,
    address: '1 Main St',
    recipientName: 'R',
    recipientContact: 'c',
    weightKg: 1,
    destination: { lat: 0, lng: 0 },
    status,
    trackingToken: `trk-${Math.random().toString(36).slice(2)}`,
    createdAt: now,
    updatedAt: now,
  });
}

function service(repo: InMemoryDeliveryRepository): DeliveryService {
  return new DeliveryService(repo, { geocode: async () => ({ lat: 0, lng: 0 }) });
}

const allStatuses = Object.values(DeliveryStatus);
const allEvents = Object.values(DeliveryEvent);

describe('delivery lifecycle properties', () => {
  it(tag(20, 'Delivery lifecycle honors only defined transitions'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...allStatuses),
        fc.constantFrom(...allEvents),
        async (status, event) => {
          const repo = new InMemoryDeliveryRepository();
          const svc = service(repo);
          const delivery = await seedDelivery(repo, status);
          const target = nextStatus(status, event);

          if (target === null) {
            // Undefined/terminal transition: rejected, status retained.
            const opts =
              event === DeliveryEvent.Fail ? { reason: 'x' } : {};
            await expect(
              svc.transition(delivery.id, event, opts),
            ).rejects.toBeInstanceOf(DomainError);
            const after = await repo.findById(delivery.id);
            expect(after?.status).toBe(status);
          } else {
            const opts =
              event === DeliveryEvent.Fail ? { reason: 'reason' } : {};
            const updated = await svc.transition(delivery.id, event, opts);
            expect(updated.status).toBe(target);
          }
        },
      ),
      pbtParams(),
    );
  });

  it(tag(21, 'Terminal transitions record their side effects'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        async (reason) => {
          // Completed records a completion timestamp (Arrived -> Complete).
          const repoC = new InMemoryDeliveryRepository();
          const c = await seedDelivery(repoC, DeliveryStatus.Arrived);
          const completed = await service(repoC).transition(
            c.id,
            DeliveryEvent.Complete,
          );
          expect(completed.status).toBe(DeliveryStatus.Completed);
          expect(completed.completedAt).toBeTruthy();

          // Failed records the reason (In_Transit -> Fail).
          const repoF = new InMemoryDeliveryRepository();
          const f = await seedDelivery(repoF, DeliveryStatus.InTransit);
          const failed = await service(repoF).transition(
            f.id,
            DeliveryEvent.Fail,
            { reason },
          );
          expect(failed.status).toBe(DeliveryStatus.Failed);
          expect(failed.failureReason).toBe(reason);
        },
      ),
      pbtParams(),
    );
  });
});
