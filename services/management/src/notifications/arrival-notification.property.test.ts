import fc from 'fast-check';
import {
  AssignmentStatus,
  DeliveryStatus,
  ZoneEventType,
  type ZoneEventMessage,
} from '@fleet/contracts';

import { pbtParams, tag } from '../testing/pbt';
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
const VEHICLES = ['veh-1', 'veh-2'];
const ZONES = ['zone-1', 'zone-2'];

interface Spec {
  id: number;
  vehicleId: string;
  zoneId: string;
  status: DeliveryStatus;
  assignmentComplete: boolean;
}

const specArb = fc.record({
  id: fc.nat(1000),
  vehicleId: fc.constantFrom(...VEHICLES),
  zoneId: fc.constantFrom(...ZONES),
  status: fc.constantFrom(...Object.values(DeliveryStatus)),
  assignmentComplete: fc.boolean(),
});

describe('arrival notification properties', () => {
  it(tag(31, "Destination-zone entry notifies the delivery's customer"), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(specArb, { selector: (s) => s.id, minLength: 1, maxLength: 12 }),
        fc.constantFrom(...VEHICLES),
        fc.constantFrom(...ZONES),
        async (specs, eventVehicle, eventZone) => {
          const deliveryRepo = new InMemoryDeliveryRepository();
          const assignmentRepo = new InMemoryAssignmentRepository();

          for (const s of specs) {
            const assignmentId = `asg-${s.id}`;
            const assignment: Assignment = {
              id: assignmentId,
              driverId: `drv-${s.id}`,
              vehicleId: s.vehicleId,
              status: s.assignmentComplete
                ? AssignmentStatus.Complete
                : AssignmentStatus.Accepted,
              createdAt: ISO,
            };
            await assignmentRepo.insert(assignment);
            const delivery: Delivery = {
              id: `del-${s.id}`,
              address: 'a',
              recipientName: 'R',
              recipientContact: 'c',
              weightKg: 1,
              destination: { lat: 0, lng: 0 },
              status: s.status,
              trackingToken: `trk-${s.id}`,
              assignmentId,
              destinationZoneId: s.zoneId,
              createdAt: ISO,
              updatedAt: ISO,
            };
            await deliveryRepo.insert(delivery);
          }

          const notifier = new RecordingCustomerNotifier();
          const service = new ArrivalNotificationService(
            deliveryRepo,
            assignmentRepo,
            notifier,
          );

          const event: ZoneEventMessage = {
            vehicleId: eventVehicle,
            zoneId: eventZone,
            type: ZoneEventType.Enter,
            timestamp: ISO,
          };
          await service.handleZoneEvent(event);

          // Oracle: matching vehicle + zone, non-terminal delivery, active assignment.
          const expected = new Set(
            specs
              .filter(
                (s) =>
                  s.vehicleId === eventVehicle &&
                  s.zoneId === eventZone &&
                  !s.assignmentComplete &&
                  s.status !== DeliveryStatus.Completed &&
                  s.status !== DeliveryStatus.Failed &&
                  s.status !== DeliveryStatus.Cancelled,
              )
              .map((s) => `del-${s.id}`),
          );

          expect(new Set(notifier.notified.map((n) => n.deliveryId))).toEqual(
            expected,
          );
        },
      ),
      pbtParams(),
    );
  });
});
