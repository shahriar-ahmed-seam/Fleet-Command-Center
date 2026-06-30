import { DriverStatus } from '@fleet/contracts';


export type DriverAvailabilityTarget =
  | DriverStatus.Available
  | DriverStatus.OnBreak
  | DriverStatus.Offline;

/** The set of targets a driver may request directly. */
export const DRIVER_SETTABLE_STATUSES: readonly DriverStatus[] = [
  DriverStatus.Available,
  DriverStatus.OnBreak,
  DriverStatus.Offline,
] as const;

/**
 * Allowed driver-initiated transitions, keyed by the current status. A target
 * is permitted only if it appears in the source status's set. `On_Delivery`
 * has no driver-initiated outgoing transitions.
 */
const DRIVER_TRANSITIONS: Readonly<Record<DriverStatus, readonly DriverStatus[]>> = {
  [DriverStatus.Offline]: [DriverStatus.Available],
  [DriverStatus.Available]: [DriverStatus.OnBreak, DriverStatus.Offline],
  [DriverStatus.OnBreak]: [DriverStatus.Available, DriverStatus.Offline],
  [DriverStatus.OnDelivery]: [],
};


export function isDriverSettableTransition(
  from: DriverStatus,
  to: DriverStatus,
): boolean {
  if (!DRIVER_SETTABLE_STATUSES.includes(to)) return false;
  return DRIVER_TRANSITIONS[from].includes(to);
}


export function isEligibleStatus(status: DriverStatus): boolean {
  return status === DriverStatus.Available;
}
