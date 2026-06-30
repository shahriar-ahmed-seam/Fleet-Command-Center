import { AssignmentStatus } from '@fleet/contracts';
import type {
  AssignmentRecord,
  DeliveryRecord,
  DriverRecord,
  RouteRecord,
  VehiclePosition,
} from './types';

/** Everything the driver detail panel needs for a selected driver. */
export interface DriverDetail {
  driver: DriverRecord;
  /** The driver's active (non-complete) assignment, if any. */
  assignment: AssignmentRecord | null;
  /** The route for the active assignment, if any. */
  route: RouteRecord | null;
  /** Deliveries belonging to the active assignment, in assignment order. */
  deliveries: DeliveryRecord[];
  /** Current position of the driver's vehicle, if known. */
  position: VehiclePosition | null;
}

/**
 * Build the detail view for `driverId` from the operations population. Returns
 * `null` when the driver does not exist. The active assignment is the driver's
 * first assignment whose status is not Complete; its route, ordered deliveries,
 * and the associated vehicle's live position are gathered alongside. Pure.
 */
export function buildDriverDetail(
  driverId: string,
  drivers: readonly DriverRecord[],
  assignments: readonly AssignmentRecord[],
  routes: readonly RouteRecord[],
  deliveries: readonly DeliveryRecord[],
  positions: readonly VehiclePosition[],
): DriverDetail | null {
  const driver = drivers.find((d) => d.driverId === driverId);
  if (!driver) return null;

  const assignment =
    assignments.find(
      (a) => a.driverId === driverId && a.status !== AssignmentStatus.Complete,
    ) ?? null;

  const route = assignment
    ? routes.find((r) => r.assignmentId === assignment.assignmentId) ?? null
    : null;

  // Deliveries in the order they appear on the assignment.
  const byId = new Map(deliveries.map((d) => [d.deliveryId, d]));
  const assignedDeliveries = assignment
    ? assignment.deliveryIds
        .map((id) => byId.get(id))
        .filter((d): d is DeliveryRecord => d != null)
    : [];

  const vehicleId = assignment?.vehicleId ?? driver.vehicleId ?? null;
  const position = vehicleId
    ? positions.find((p) => p.vehicleId === vehicleId) ?? null
    : null;

  return { driver, assignment, route, deliveries: assignedDeliveries, position };
}
