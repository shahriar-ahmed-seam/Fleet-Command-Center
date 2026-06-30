import { test, expect } from 'vitest';
import fc from 'fast-check';
import { MIN_ITERATIONS } from '../testing/pbt';
import {
  windowTrace,
  filterVehicles,
  TRACE_WINDOW_MS,
  type TracePing,
  type VehicleState,
} from './geo';

const NOW = 1_700_000_000_000;

test('Feature: fleet-command-center, Property 14: Path trace is chronological and windowed', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.integer({ min: -TRACE_WINDOW_MS - 10000, max: 10000 }),
        { maxLength: 200 },
      ),
      (offsets) => {
        const pings: TracePing[] = offsets.map((o, i) => ({
          lat: i * 0.001,
          lng: i * 0.001,
          timestamp: NOW + o,
        }));
        const out = windowTrace(pings, NOW);

        // 1) Every output ping is within the 60-minute window and not future.
        for (const p of out) {
          const t = p.timestamp as number;
          expect(t).toBeGreaterThanOrEqual(NOW - TRACE_WINDOW_MS);
          expect(t).toBeLessThanOrEqual(NOW);
        }
        // 2) Output is chronological (non-decreasing).
        for (let i = 1; i < out.length; i++) {
          expect(out[i].timestamp as number).toBeGreaterThanOrEqual(
            out[i - 1].timestamp as number,
          );
        }
        // 3) Count equals the number of in-window pings.
        const expected = offsets.filter(
          (o) => o >= -TRACE_WINDOW_MS && o <= 0,
        ).length;
        expect(out).toHaveLength(expected);
      },
    ),
    { numRuns: MIN_ITERATIONS },
  );
});

const STATUSES = ['Available', 'On_Delivery', 'On_Break', 'Offline'];
const ZONES = ['z1', 'z2'];

test('Feature: fleet-command-center, Property 15: Live map shows exactly the vehicles matching the filter', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          vehicleId: fc.string({ minLength: 1, maxLength: 6 }),
          driverStatus: fc.constantFrom(...STATUSES),
          active: fc.boolean(),
          zoneIds: fc.subarray(ZONES),
        }),
        { maxLength: 30 },
      ),
      fc.option(fc.constantFrom(...STATUSES), { nil: null }),
      fc.option(fc.constantFrom(...ZONES), { nil: null }),
      (raw, statusFilter, zoneFilter) => {
        const vehicles: VehicleState[] = raw.map((v, i) => ({
          ...v,
          vehicleId: `${v.vehicleId}-${i}`,
          lat: 0,
          lng: 0,
        }));
        const out = filterVehicles(vehicles, {
          driverStatus: statusFilter,
          zoneId: zoneFilter,
        });

        const expected = vehicles.filter(
          (v) =>
            v.active !== false &&
            (!statusFilter || v.driverStatus === statusFilter) &&
            (!zoneFilter || (v.zoneIds ?? []).includes(zoneFilter)),
        );
        expect(new Set(out.map((v) => v.vehicleId))).toEqual(
          new Set(expected.map((v) => v.vehicleId)),
        );
        // No inactive vehicle is ever shown.
        expect(out.every((v) => v.active !== false)).toBe(true);
      },
    ),
    { numRuns: MIN_ITERATIONS },
  );
});
