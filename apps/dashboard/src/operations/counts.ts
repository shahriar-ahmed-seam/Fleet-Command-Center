import { DriverStatus, DeliveryStatus } from '@fleet/contracts';

/** A status → count map plus the population total. */
export interface StatusCounts {
  /** Count per canonical status (every listed status present, zero-filled). */
  byStatus: Record<string, number>;
  /** Total number of records counted. */
  total: number;
}

/**
 * Count `items` grouped by status over a canonical status list. Every status in
 * `statuses` is present in the result (zero when none match); items whose status
 * is not in the list are still counted under their own key so totals stay exact.
 * Pure and order-independent.
 */
export function countByStatus<T>(
  items: readonly T[],
  statusOf: (item: T) => string,
  statuses: readonly string[],
): StatusCounts {
  const byStatus: Record<string, number> = {};
  for (const s of statuses) byStatus[s] = 0;
  for (const item of items) {
    const s = statusOf(item);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  return { byStatus, total: items.length };
}


export const DRIVER_STATUS_ORDER: readonly string[] = Object.values(DriverStatus);


export const DELIVERY_STATUS_ORDER: readonly string[] = Object.values(DeliveryStatus);
