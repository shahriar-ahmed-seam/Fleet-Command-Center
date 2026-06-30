import { test, expect } from 'vitest';
import fc from 'fast-check';
import { MIN_ITERATIONS } from '../testing/pbt';
import { countByStatus } from './counts';
import { searchDeliveries } from './search';
import type { DeliveryRecord } from './types';

const STATUSES = ['Created', 'Assigned', 'In_Transit', 'Completed', 'Failed'];

test('Feature: fleet-command-center, Property 33: Status counts equal actual grouped counts', () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom(...STATUSES), { maxLength: 100 }),
      (items) => {
        const records = items.map((status, i) => ({ id: i, status }));
        const { byStatus, total } = countByStatus(
          records,
          (r) => r.status,
          STATUSES,
        );

        // Total equals the population size.
        expect(total).toBe(records.length);
        // Each status count equals the true number with that status.
        for (const s of STATUSES) {
          const actual = items.filter((x) => x === s).length;
          expect(byStatus[s]).toBe(actual);
        }
        // The counts sum to the total.
        const sum = Object.values(byStatus).reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      },
    ),
    { numRuns: MIN_ITERATIONS },
  );
});

function delivery(id: string, recipient: string): DeliveryRecord {
  return {
    deliveryId: id,
    recipientName: recipient,
    destinationAddress: '1 Main St',
    status: 'Created',
  };
}

test('Feature: fleet-command-center, Property 34: Delivery search returns exactly the matching deliveries', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 8 }),
          recipient: fc.string({ minLength: 0, maxLength: 12 }),
        }),
        { maxLength: 40 },
      ),
      fc.string({ maxLength: 6 }),
      (rows, query) => {
        const deliveries = rows.map((r, i) =>
          delivery(`${r.id}-${i}`, r.recipient),
        );
        const out = searchDeliveries(deliveries, query);
        const q = query.trim().toLowerCase();

        const expected =
          q === ''
            ? []
            : deliveries.filter(
                (d) =>
                  d.deliveryId.toLowerCase().includes(q) ||
                  d.recipientName.toLowerCase().includes(q),
              );

        expect(new Set(out.map((d) => d.deliveryId))).toEqual(
          new Set(expected.map((d) => d.deliveryId)),
        );
        // Every returned delivery genuinely matches (no false positives).
        for (const d of out) {
          expect(
            d.deliveryId.toLowerCase().includes(q) ||
              d.recipientName.toLowerCase().includes(q),
          ).toBe(true);
        }
      },
    ),
    { numRuns: MIN_ITERATIONS },
  );
});
