import type { RouteStop } from '@fleet/contracts';

/** A driver as shown in the operations console. */
export interface DriverRecord {
  driverId: string;
  name: string;
  /** Driver_Status value (see `@fleet/contracts` DriverStatus). */
  status: string;
  /** Currently associated vehicle, if any. */
  vehicleId?: string | null;
  contact?: string;
}

/** A delivery as shown in the operations console. */
export interface DeliveryRecord {
  
  deliveryId: string;
  recipientName: string;
  recipientContact?: string;
  destinationAddress: string;
  /** Delivery_Status value (see `@fleet/contracts` DeliveryStatus). */
  status: string;
  /** Active assignment this delivery belongs to, if any. */
  assignmentId?: string | null;
}

/** An assignment linking deliveries to a driver and vehicle. */
export interface AssignmentRecord {
  assignmentId: string;
  driverId: string;
  vehicleId: string;
  deliveryIds: string[];
  /** AssignmentStatus value (Pending | Accepted | Complete). */
  status: string;
}

/** An ordered route for an assignment. */
export interface RouteRecord {
  assignmentId: string;
  stops: RouteStop[];
  optimized: boolean;
}


export interface VehiclePosition {
  vehicleId: string;
  lat: number;
  lng: number;
  timestamp?: string | number;
}
