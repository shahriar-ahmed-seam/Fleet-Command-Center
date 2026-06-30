import fc from 'fast-check';

import { pbtParams, tag } from '../testing/pbt';
import { authorize, Action, ResourceType, type Principal } from './rbac';
import { Role } from './roles';

const ADMIN_MANAGED = new Set([
  ResourceType.Driver,
  ResourceType.Vehicle,
  ResourceType.Zone,
]);
const DISPATCHABLE = new Set([ResourceType.Delivery, ResourceType.Assignment]);


function expectedAllowed(role: Role, action: Action, type: ResourceType): boolean {
  switch (role) {
    case Role.Administrator:
      return true;
    case Role.Dispatcher:
      if (action === Action.Read) return true;
      return action === Action.Create && DISPATCHABLE.has(type);
    default:
      return false; // Driver/Customer handled by scope tests
  }
}

describe('RBAC properties', () => {
  it(tag(35, 'Authorization follows the role permission matrix'), () => {
    fc.assert(
      fc.property(
        fc.constantFrom(Role.Administrator, Role.Dispatcher),
        fc.constantFrom(...Object.values(Action)),
        fc.constantFrom(...Object.values(ResourceType)),
        (role, action, type) => {
          const principal: Principal = { role, userId: 'u1' };
          const decision = authorize(principal, action, { type });
          expect(decision.allowed).toBe(expectedAllowed(role, action, type));
          // Admin-managed writes are never granted to a Dispatcher.
          if (
            role === Role.Dispatcher &&
            action !== Action.Read &&
            ADMIN_MANAGED.has(type)
          ) {
            expect(decision.allowed).toBe(false);
          }
        },
      ),
      pbtParams(),
    );
  });

  it(tag(32, 'Resource access is restricted to owners and link scope'), () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        (driverId, otherDriverId, deliveryId, otherDeliveryId) => {
          const driver: Principal = { role: Role.Driver, userId: driverId };
          const ownAssignment = authorize(driver, Action.Read, {
            type: ResourceType.Assignment,
            ownerDriverId: driverId,
          });
          const foreignAssignment = authorize(driver, Action.Read, {
            type: ResourceType.Assignment,
            ownerDriverId: otherDriverId === driverId ? `${otherDriverId}x` : otherDriverId,
          });
          expect(ownAssignment.allowed).toBe(true);
          expect(foreignAssignment.allowed).toBe(false);
          // Drivers never write.
          expect(
            authorize(driver, Action.Create, { type: ResourceType.Delivery }).allowed,
          ).toBe(false);

          // Customer: may read only the delivery named by the link scope (13.6).
          const customer: Principal = {
            role: Role.Customer,
            trackingScope: `delivery:${deliveryId}`,
          };
          const own = authorize(customer, Action.Read, {
            type: ResourceType.Delivery,
            deliveryId,
          });
          const foreign = authorize(customer, Action.Read, {
            type: ResourceType.Delivery,
            deliveryId: otherDeliveryId === deliveryId ? `${otherDeliveryId}x` : otherDeliveryId,
          });
          expect(own.allowed).toBe(true);
          expect(foreign.allowed).toBe(false);
        },
      ),
      pbtParams(),
    );
  });
});
