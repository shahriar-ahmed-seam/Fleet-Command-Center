import React from 'react';
import {
  AssignmentStatus,
  DeliveryStatus,
  DriverStatus,
} from '@fleet/contracts';
import type {
  AssignmentRecord,
  DeliveryRecord,
  DriverRecord,
  RouteRecord,
} from './types';

const SEED_DRIVERS: DriverRecord[] = [
  { driverId: 'DRV-1', name: 'Maya Chen', status: DriverStatus.OnDelivery, vehicleId: 'VAN-014', contact: '+1 206 555 0142' },
  { driverId: 'DRV-2', name: 'Liam Patel', status: DriverStatus.Available, vehicleId: 'VAN-022', contact: '+1 206 555 0228' },
  { driverId: 'DRV-3', name: 'Sofia Rossi', status: DriverStatus.OnBreak, vehicleId: 'TRK-003', contact: '+1 206 555 0303' },
  { driverId: 'DRV-4', name: 'Noah Kim', status: DriverStatus.OnDelivery, vehicleId: 'VAN-031', contact: '+1 206 555 0319' },
  { driverId: 'DRV-5', name: 'Ava Nguyen', status: DriverStatus.Offline, vehicleId: null, contact: '+1 206 555 0500' },
];

const SEED_DELIVERIES: DeliveryRecord[] = [
  { deliveryId: 'DLV-1001', recipientName: 'Grace Holloway', recipientContact: '+1 206 555 1101', destinationAddress: '1201 3rd Ave, Seattle, WA', status: DeliveryStatus.InTransit, assignmentId: 'ASN-1' },
  { deliveryId: 'DLV-1002', recipientName: 'Marcus Webb', recipientContact: '+1 206 555 1102', destinationAddress: '400 Pine St, Seattle, WA', status: DeliveryStatus.Assigned, assignmentId: 'ASN-1' },
  { deliveryId: 'DLV-1003', recipientName: 'Priya Nair', recipientContact: '+1 206 555 1103', destinationAddress: '2100 Western Ave, Seattle, WA', status: DeliveryStatus.Arrived, assignmentId: 'ASN-2' },
  { deliveryId: 'DLV-1004', recipientName: 'Daniel Okafor', recipientContact: '+1 206 555 1104', destinationAddress: '1730 Minor Ave, Seattle, WA', status: DeliveryStatus.Assigned, assignmentId: 'ASN-2' },
  { deliveryId: 'DLV-1005', recipientName: 'Elena Vasquez', recipientContact: '+1 206 555 1105', destinationAddress: '500 Mercer St, Seattle, WA', status: DeliveryStatus.Created, assignmentId: null },
  { deliveryId: 'DLV-1006', recipientName: 'Tomas Berg', recipientContact: '+1 206 555 1106', destinationAddress: '88 Spring St, Seattle, WA', status: DeliveryStatus.Completed, assignmentId: null },
  { deliveryId: 'DLV-1007', recipientName: 'Hannah Lee', recipientContact: '+1 206 555 1107', destinationAddress: '2200 1st Ave, Seattle, WA', status: DeliveryStatus.Cancelled, assignmentId: null },
  { deliveryId: 'DLV-1008', recipientName: 'Grace Park', recipientContact: '+1 206 555 1108', destinationAddress: '305 Harrison St, Seattle, WA', status: DeliveryStatus.Failed, assignmentId: null },
];

const SEED_ASSIGNMENTS: AssignmentRecord[] = [
  { assignmentId: 'ASN-1', driverId: 'DRV-1', vehicleId: 'VAN-014', deliveryIds: ['DLV-1001', 'DLV-1002'], status: AssignmentStatus.Accepted },
  { assignmentId: 'ASN-2', driverId: 'DRV-4', vehicleId: 'VAN-031', deliveryIds: ['DLV-1003', 'DLV-1004'], status: AssignmentStatus.Accepted },
];

const SEED_ROUTES: RouteRecord[] = [
  {
    assignmentId: 'ASN-1',
    optimized: true,
    stops: [
      { stopIndex: 0, deliveryIds: ['DLV-1001'], lat: 47.6062, lng: -122.3321 },
      { stopIndex: 1, deliveryIds: ['DLV-1002'], lat: 47.6131, lng: -122.3367 },
    ],
  },
  {
    assignmentId: 'ASN-2',
    optimized: true,
    stops: [
      { stopIndex: 0, deliveryIds: ['DLV-1003'], lat: 47.6113, lng: -122.3458 },
      { stopIndex: 1, deliveryIds: ['DLV-1004'], lat: 47.6175, lng: -122.3289 },
    ],
  },
];

/** The operations population read by the dashboard surfaces. */
export interface OperationsState {
  drivers: DriverRecord[];
  deliveries: DeliveryRecord[];
  assignments: AssignmentRecord[];
  routes: RouteRecord[];
}

/**
 * Provide the operations population. Currently a stable demo seed; structured as
 * a hook so a REST snapshot + live event reconciliation can drop in later
 * without changing consumers.
 */
export function useOperationsState(): OperationsState {
  return React.useMemo(
    () => ({
      drivers: SEED_DRIVERS,
      deliveries: SEED_DELIVERIES,
      assignments: SEED_ASSIGNMENTS,
      routes: SEED_ROUTES,
    }),
    [],
  );
}
