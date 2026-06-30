import { DeliveryStatus, TERMINAL_DELIVERY_STATUSES } from '@fleet/contracts';

/**
 * The events that drive delivery lifecycle transitions. Each corresponds to a
 * dispatcher or driver action in the requirements.
 */
export enum DeliveryEvent {
  
  Assign = 'Assign',
  
  StartTransit = 'StartTransit',
  
  Arrive = 'Arrive',
  
  Complete = 'Complete',
  
  Fail = 'Fail',
  
  Cancel = 'Cancel',
}


export const FAILURE_REASON_MIN = 1;
export const FAILURE_REASON_MAX = 500;

/**
 * The `(state, event) -> nextState` transition table. Terminal states
 * (`Completed`/`Failed`/`Cancelled`) intentionally have no entries.
 */
const TRANSITIONS: Readonly<
  Record<DeliveryStatus, Partial<Record<DeliveryEvent, DeliveryStatus>>>
> = {
  [DeliveryStatus.Created]: {
    [DeliveryEvent.Assign]: DeliveryStatus.Assigned,
    [DeliveryEvent.Cancel]: DeliveryStatus.Cancelled,
  },
  [DeliveryStatus.Assigned]: {
    [DeliveryEvent.StartTransit]: DeliveryStatus.InTransit,
    [DeliveryEvent.Cancel]: DeliveryStatus.Cancelled,
  },
  [DeliveryStatus.InTransit]: {
    [DeliveryEvent.Arrive]: DeliveryStatus.Arrived,
    [DeliveryEvent.Fail]: DeliveryStatus.Failed,
    [DeliveryEvent.Cancel]: DeliveryStatus.Cancelled,
  },
  [DeliveryStatus.Arrived]: {
    [DeliveryEvent.Complete]: DeliveryStatus.Completed,
    [DeliveryEvent.Fail]: DeliveryStatus.Failed,
    [DeliveryEvent.Cancel]: DeliveryStatus.Cancelled,
  },
  [DeliveryStatus.Completed]: {},
  [DeliveryStatus.Failed]: {},
  [DeliveryStatus.Cancelled]: {},
};

/**
 * The next status for a `(from, event)` pair, or `null` when the transition is
 * undefined (including every transition out of a terminal state). Pure and
 * side-effect free so it can back both the service and its property tests.
 */
export function nextStatus(
  from: DeliveryStatus,
  event: DeliveryEvent,
): DeliveryStatus | null {
  return TRANSITIONS[from][event] ?? null;
}


export function isTerminal(status: DeliveryStatus): boolean {
  return TERMINAL_DELIVERY_STATUSES.includes(status);
}

/** Whether `event` is a legal transition from `from`. */
export function canTransition(
  from: DeliveryStatus,
  event: DeliveryEvent,
): boolean {
  return nextStatus(from, event) !== null;
}


export function isValidFailureReason(reason: unknown): reason is string {
  return (
    typeof reason === 'string' &&
    reason.length >= FAILURE_REASON_MIN &&
    reason.length <= FAILURE_REASON_MAX
  );
}
