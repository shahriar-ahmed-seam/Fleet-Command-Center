// @vitest-environment jsdom

import { test, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AssignmentStatus, DeliveryStatus, DriverStatus } from '@fleet/contracts';
import { DriversView } from './DriversView';
import type {
  AssignmentRecord,
  DeliveryRecord,
  DriverRecord,
  RouteRecord,
  VehiclePosition,
} from './types';

afterEach(cleanup);

const drivers: DriverRecord[] = [
  { driverId: 'DRV-1', name: 'Maya Chen', status: DriverStatus.OnDelivery, vehicleId: 'VAN-014' },
];
const deliveries: DeliveryRecord[] = [
  { deliveryId: 'DLV-1', recipientName: 'Grace', destinationAddress: '1 Main St', status: DeliveryStatus.InTransit, assignmentId: 'ASN-1' },
];
const assignments: AssignmentRecord[] = [
  { assignmentId: 'ASN-1', driverId: 'DRV-1', vehicleId: 'VAN-014', deliveryIds: ['DLV-1'], status: AssignmentStatus.Accepted },
];
const routes: RouteRecord[] = [
  { assignmentId: 'ASN-1', optimized: true, stops: [{ stopIndex: 0, deliveryIds: ['DLV-1'], lat: 47.6, lng: -122.3 }] },
];
const positions: VehiclePosition[] = [{ vehicleId: 'VAN-014', lat: 47.6062, lng: -122.3321 }];

test('selecting a driver shows assignment, route, and live position', () => {
  render(
    <DriversView
      drivers={drivers}
      deliveries={deliveries}
      assignments={assignments}
      routes={routes}
      positions={positions}
    />,
  );

  // Roster renders the driver.
  expect(screen.getByText('Maya Chen')).not.toBeNull();
  // Before selection, the detail panel prompts the dispatcher.
  expect(screen.getByText(/Select a driver/i)).not.toBeNull();

  // Select the driver row.
  fireEvent.click(screen.getByText('Maya Chen'));

  // Detail panel now shows the active assignment, route summary, and position.
  expect(screen.getByText('ASN-1')).not.toBeNull();
  expect(screen.getByText(/1 stop · optimized/)).not.toBeNull();
  expect(screen.getByText(/47\.60620, -122\.33210/)).not.toBeNull();
});
