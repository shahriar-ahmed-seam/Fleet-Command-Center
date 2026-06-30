import {
  TERMINAL_DELIVERY_STATUSES,
  ZoneEventType,
  type ZoneEventMessage,
} from '@fleet/contracts';

import {
  type Delivery,
  type DeliveryRepository,
} from '../deliveries/delivery-repository';
import {
  isActiveAssignment,
  type AssignmentRepository,
} from '../assignments/assignment-repository';
import {
  type ArrivalNotification,
  type CustomerNotifier,
} from './customer-notifier';

export class ArrivalNotificationService {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly assignments: AssignmentRepository,
    private readonly notifier: CustomerNotifier,
  ) {}

  
  async handleZoneEvent(event: ZoneEventMessage): Promise<ArrivalNotification[]> {
    if (event.type !== ZoneEventType.Enter) {
      return [];
    }

    const candidates = await this.deliveries.listByDestinationZoneId(event.zoneId);
    const routed: ArrivalNotification[] = [];

    for (const delivery of candidates) {
      if (!(await this.isArrivalForVehicle(delivery, event.vehicleId))) {
        continue;
      }
      const notification: ArrivalNotification = {
        deliveryId: delivery.id,
        trackingToken: delivery.trackingToken,
        zoneId: event.zoneId,
        vehicleId: event.vehicleId,
        label: event.label,
        timestamp: event.timestamp,
      };
      await this.notifier.notifyArrival(notification);
      routed.push(notification);
    }

    return routed;
  }

  /**
   * A delivery is an arrival for the entering vehicle when it is not terminal
   * and belongs to an active assignment carried by that vehicle.
   */
  private async isArrivalForVehicle(
    delivery: Delivery,
    vehicleId: string,
  ): Promise<boolean> {
    if (TERMINAL_DELIVERY_STATUSES.includes(delivery.status)) {
      return false;
    }
    if (!delivery.assignmentId) {
      return false;
    }
    const assignment = await this.assignments.findById(delivery.assignmentId);
    if (!assignment || !isActiveAssignment(assignment)) {
      return false;
    }
    return assignment.vehicleId === vehicleId;
  }
}
