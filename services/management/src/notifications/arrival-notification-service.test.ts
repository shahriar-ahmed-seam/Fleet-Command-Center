import {
  AssignmentStatus,
  DeliveryStatus,
  ZoneEventType,
  type ZoneEventMessage,
} from '@fleet/contracts';

import {
  InMemoryDeliveryRepository,
  type Delivery,
} from '../deliveries/delivery-repository';
import {
  InMemoryAssignmentRepository,
  type Assignment,
} from '../assignments/assignment-repository';
import { RecordingCustomerNotifier } from './customer-notifier';
import { ArrivalNotificationService } from './arrival-notification-service';

const ISO = new Date(1_700_000_000_000).toISOString();

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: 'del-1',
    address: '1 Main St',
    recipientName: 'Rae',
    recipientContact: '555-1',
    weightKg: 10,
    destination: { lat: 1, lng: 2 },
    status: DeliveryStatus.InTransit,
    trackingToken: 'trk-del-1',
    assignmentId: 'asg-1',
    destinationZoneId: 'zone-1',
    createdAt: ISO,
    updatedAt: ISO,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'asg-1',
    driverId: 'drv-1',
    vehicleId: 'veh-1',
    status: AssignmentStatus.Accepted,
    createdAt: ISO,
    ...overrides,
  };
}

function enterEvent(overrides: Partial<ZoneEventMessage> = {}): ZoneEventMessage {
  return {
    vehicleId: 'veh-1',
    zoneId: 'zone-1',
    type: ZoneEventType.Enter,
    timestamp: ISO,
    ...overrides,
  };
}

async function setup(deliveries: Delivery[], assignments: Assignment[]) {
  const deliveryRepo = new InMemoryDeliveryRepository();
  const assignmentRepo = new InMemoryAssignmentRepository();
  for (const d of deliveries) await deliveryRepo.insert(d);
  for (const a of assignments) await assignmentRepo.insert(a);
  const notifier = new RecordingCustomerNotifier();
  const service = new ArrivalNotificationService(
    deliveryRepo,
    assignmentRepo,
    notifier,
  );
  return { service, notifier };
}

describe('ArrivalNotificationService', () => {
  it('notifies the delivery customer when its vehicle enters the destination zone', async () => {
    const { service, notifier } = await setup(
      [makeDelivery()],
      [makeAssignment()],
    );

    const routed = await service.handleZoneEvent(enterEvent());

    expect(routed).toHaveLength(1);
    expect(notifier.notified).toHaveLength(1);
    expect(notifier.notified[0]).toMatchObject({
      deliveryId: 'del-1',
      trackingToken: 'trk-del-1',
      zoneId: 'zone-1',
      vehicleId: 'veh-1',
      timestamp: ISO,
    });
  });

  it('carries the zone arrival label when present', async () => {
    const { service, notifier } = await setup(
      [makeDelivery()],
      [makeAssignment()],
    );

    await service.handleZoneEvent(enterEvent({ label: 'Front Desk' }));

    expect(notifier.notified[0].label).toBe('Front Desk');
  });

  it('does not notify on an Exit event', async () => {
    const { service, notifier } = await setup(
      [makeDelivery()],
      [makeAssignment()],
    );

    const routed = await service.handleZoneEvent(
      enterEvent({ type: ZoneEventType.Exit }),
    );

    expect(routed).toHaveLength(0);
    expect(notifier.notified).toHaveLength(0);
  });

  it('does not notify when a different vehicle enters the destination zone', async () => {
    const { service, notifier } = await setup(
      [makeDelivery()], // delivered by veh-1
      [makeAssignment()],
    );

    const routed = await service.handleZoneEvent(
      enterEvent({ vehicleId: 'veh-OTHER' }),
    );

    expect(routed).toHaveLength(0);
    expect(notifier.notified).toHaveLength(0);
  });

  it('does not notify when the entered zone is not the destination zone', async () => {
    const { service, notifier } = await setup(
      [makeDelivery({ destinationZoneId: 'zone-1' })],
      [makeAssignment()],
    );

    const routed = await service.handleZoneEvent(
      enterEvent({ zoneId: 'zone-OTHER' }),
    );

    expect(routed).toHaveLength(0);
    expect(notifier.notified).toHaveLength(0);
  });

  it('notifies only the matching delivery when another shares the destination zone via a different vehicle', async () => {
    const mine = makeDelivery({
      id: 'del-mine',
      trackingToken: 'trk-mine',
      assignmentId: 'asg-1',
    });
    const theirs = makeDelivery({
      id: 'del-theirs',
      trackingToken: 'trk-theirs',
      assignmentId: 'asg-2',
    });
    const { service, notifier } = await setup(
      [mine, theirs],
      [
        makeAssignment({ id: 'asg-1', vehicleId: 'veh-1' }),
        makeAssignment({ id: 'asg-2', vehicleId: 'veh-2' }),
      ],
    );

    const routed = await service.handleZoneEvent(
      enterEvent({ vehicleId: 'veh-1' }),
    );

    expect(routed.map((n) => n.deliveryId)).toEqual(['del-mine']);
    expect(notifier.notified.map((n) => n.deliveryId)).toEqual(['del-mine']);
  });

  it('notifies each co-located delivery carried by the same vehicle', async () => {
    const a = makeDelivery({
      id: 'del-a',
      trackingToken: 'trk-a',
      assignmentId: 'asg-1',
    });
    const b = makeDelivery({
      id: 'del-b',
      trackingToken: 'trk-b',
      assignmentId: 'asg-1',
    });
    const { service, notifier } = await setup([a, b], [makeAssignment()]);

    const routed = await service.handleZoneEvent(enterEvent());

    expect(new Set(routed.map((n) => n.deliveryId))).toEqual(
      new Set(['del-a', 'del-b']),
    );
    expect(notifier.notified).toHaveLength(2);
  });

  it('does not notify a delivery in a terminal status', async () => {
    const { service, notifier } = await setup(
      [makeDelivery({ status: DeliveryStatus.Cancelled })],
      [makeAssignment()],
    );

    const routed = await service.handleZoneEvent(enterEvent());

    expect(routed).toHaveLength(0);
    expect(notifier.notified).toHaveLength(0);
  });

  it('does not notify when the assignment is already complete', async () => {
    const { service, notifier } = await setup(
      [makeDelivery()],
      [makeAssignment({ status: AssignmentStatus.Complete })],
    );

    const routed = await service.handleZoneEvent(enterEvent());

    expect(routed).toHaveLength(0);
    expect(notifier.notified).toHaveLength(0);
  });
});
