import type { ColorToken } from './tokens.js';

/** Driver_Status wire values (mirror @fleet/contracts DriverStatus). */
export type DriverStatusKey =
  | 'Offline'
  | 'Available'
  | 'On_Delivery'
  | 'On_Break';

/** Delivery_Status wire values (mirror @fleet/contracts DeliveryStatus). */
export type DeliveryStatusKey =
  | 'Created'
  | 'Assigned'
  | 'In_Transit'
  | 'Arrived'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

/**
 * Driver_Status → semantic color token.
 * - Available  → success  (eligible, healthy)
 * - On_Delivery→ info     (actively delivering, matches In_Transit)
 * - On_Break   → warning  (temporarily unavailable)
 * - Offline    → danger   (not reachable; per design danger covers Offline)
 */
export const driverStatusColor: Record<DriverStatusKey, ColorToken> = {
  Offline: 'danger',
  Available: 'success',
  On_Delivery: 'info',
  On_Break: 'warning',
};

/**
 * Delivery_Status → semantic color token.
 * - Created    → textMuted (neutral, not yet actioned)
 * - Assigned   → accent    (scheduled to a driver)
 * - In_Transit → info      (per design)
 * - Arrived    → warning   (per design, attention/handover pending)
 * - Completed  → success   (per design)
 * - Failed     → danger    (per design)
 * - Cancelled  → textMuted (terminal, non-failure neutral)
 */
export const deliveryStatusColor: Record<DeliveryStatusKey, ColorToken> = {
  Created: 'textMuted',
  Assigned: 'accent',
  In_Transit: 'info',
  Arrived: 'warning',
  Completed: 'success',
  Failed: 'danger',
  Cancelled: 'textMuted',
};

/** Both status maps grouped for convenience and generation. */
export const statusColors = {
  driver: driverStatusColor,
  delivery: deliveryStatusColor,
} as const;
