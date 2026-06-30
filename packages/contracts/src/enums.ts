/**
 * Shared enums for Fleet Command Center wire contracts.
 *
 * These enums are the single source of truth for status values that cross
 * service boundaries (Ingestion ⇄ Streaming ⇄ Management ⇄ clients). String
 * enum members keep the on-the-wire representation stable and human-readable.
 */


export enum DriverStatus {
  Offline = 'Offline',
  Available = 'Available',
  OnDelivery = 'On_Delivery',
  OnBreak = 'On_Break',
}


export enum DeliveryStatus {
  Created = 'Created',
  Assigned = 'Assigned',
  InTransit = 'In_Transit',
  Arrived = 'Arrived',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
}


export enum AssignmentStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Complete = 'Complete',
}


export enum ZoneEventType {
  Enter = 'Enter',
  Exit = 'Exit',
}


export const TERMINAL_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  DeliveryStatus.Completed,
  DeliveryStatus.Failed,
  DeliveryStatus.Cancelled,
] as const;


export const UNAVAILABLE_DRIVER_STATUSES: readonly DriverStatus[] = [
  DriverStatus.Offline,
  DriverStatus.OnBreak,
] as const;
