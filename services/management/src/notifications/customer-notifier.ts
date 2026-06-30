/**
 * An arrival notification addressed to a single delivery's customer. It carries
 * the delivery identity (and its tracking token, the customer's scope) plus the
 * triggering zone/vehicle and the optional arrival label from the zone event.
 */
export interface ArrivalNotification {
  /** The delivery whose customer is notified. */
  deliveryId: string;
  
  trackingToken: string;
  /** The destination zone the assigned vehicle entered. */
  zoneId: string;
  /** The vehicle that entered the destination zone. */
  vehicleId: string;
  
  label?: string;
  /** ISO-8601 timestamp of the triggering Enter event. */
  timestamp: string;
}

export interface CustomerNotifier {
  
  notifyArrival(notification: ArrivalNotification): Promise<void>;
}

/**
 * A {@link CustomerNotifier} that records routed notifications, for tests and
 * local bootstrapping.
 */
export class RecordingCustomerNotifier implements CustomerNotifier {
  readonly notified: ArrivalNotification[] = [];

  notifyArrival(notification: ArrivalNotification): Promise<void> {
    this.notified.push({ ...notification });
    return Promise.resolve();
  }
}
