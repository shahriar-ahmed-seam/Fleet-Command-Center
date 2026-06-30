import { ErrorCode } from '@fleet/contracts';

import {
  authorize,
  requireAuthorization,
  Action,
  ResourceType,
  Role,
  type Principal,
  type AuthorizedRequest,
  type AuthResponse,
} from './index';

const admin: Principal = { role: Role.Administrator, userId: 'a-1' };
const dispatcher: Principal = { role: Role.Dispatcher, userId: 'd-1' };

describe('administrator authority', () => {
  it('permits every write on admin-managed and dispatchable resources', () => {
    for (const type of Object.values(ResourceType)) {
      for (const action of Object.values(Action)) {
        expect(authorize(admin, action, { type }).allowed).toBe(true);
      }
    }
  });
});

describe('dispatcher authority', () => {
  it('may create Deliveries and Assignments', () => {
    expect(
      authorize(dispatcher, Action.Create, { type: ResourceType.Delivery })
        .allowed,
    ).toBe(true);
    expect(
      authorize(dispatcher, Action.Create, { type: ResourceType.Assignment })
        .allowed,
    ).toBe(true);
  });

  it('may NOT create/update/deactivate Driver, Vehicle, or Zone records', () => {
    for (const type of [
      ResourceType.Driver,
      ResourceType.Vehicle,
      ResourceType.Zone,
    ]) {
      for (const action of [
        Action.Create,
        Action.Update,
        Action.Deactivate,
      ]) {
        const d = authorize(dispatcher, action, { type });
        expect(d.allowed).toBe(false);
        if (!d.allowed) {
          expect(d.error.error).toBe(ErrorCode.AuthorizationDenied);
        }
      }
    }
  });

  it('may read operational resources', () => {
    expect(
      authorize(dispatcher, Action.Read, { type: ResourceType.Driver }).allowed,
    ).toBe(true);
  });
});

describe('driver ownership scoping', () => {
  const driver: Principal = { role: Role.Driver, userId: 'drv-7' };

  it('permits reading an assignment linked to the driver', () => {
    expect(
      authorize(driver, Action.Read, {
        type: ResourceType.Assignment,
        ownerDriverId: 'drv-7',
      }).allowed,
    ).toBe(true);
  });

  it('permits reading a delivery linked to the driver', () => {
    expect(
      authorize(driver, Action.Read, {
        type: ResourceType.Delivery,
        ownerDriverId: 'drv-7',
      }).allowed,
    ).toBe(true);
  });

  it('denies reading another driver\'s assignment', () => {
    expect(
      authorize(driver, Action.Read, {
        type: ResourceType.Assignment,
        ownerDriverId: 'someone-else',
      }).allowed,
    ).toBe(false);
  });

  it('denies any management write by a driver', () => {
    expect(
      authorize(driver, Action.Create, { type: ResourceType.Delivery }).allowed,
    ).toBe(false);
    expect(
      authorize(driver, Action.Update, {
        type: ResourceType.Driver,
        ownerDriverId: 'drv-7',
      }).allowed,
    ).toBe(false);
  });
});

describe('customer tracking-link scoping', () => {
  const customer: Principal = {
    role: Role.Customer,
    trackingScope: 'delivery:del-42',
  };

  it('permits reading exactly the delivery named by the tracking scope', () => {
    expect(
      authorize(customer, Action.Read, {
        type: ResourceType.Delivery,
        deliveryId: 'del-42',
      }).allowed,
    ).toBe(true);
  });

  it('denies reading a different delivery', () => {
    expect(
      authorize(customer, Action.Read, {
        type: ResourceType.Delivery,
        deliveryId: 'del-99',
      }).allowed,
    ).toBe(false);
  });

  it('denies access to non-delivery resources and all writes', () => {
    expect(
      authorize(customer, Action.Read, {
        type: ResourceType.Assignment,
        ownerDriverId: 'x',
      }).allowed,
    ).toBe(false);
    expect(
      authorize(customer, Action.Create, {
        type: ResourceType.Delivery,
        deliveryId: 'del-42',
      }).allowed,
    ).toBe(false);
  });
});

describe('requireAuthorization middleware', () => {
  function mockRes(): AuthResponse & { code?: number; body?: unknown } {
    const res: AuthResponse & { code?: number; body?: unknown } = {
      status(code: number) {
        res.code = code;
        return res;
      },
      json(body: unknown) {
        res.body = body;
      },
    };
    return res;
  }

  it('calls next() when the principal is authorized', () => {
    const mw = requireAuthorization(Action.Create, () => ({
      type: ResourceType.Delivery,
    }));
    const req: AuthorizedRequest = { principal: dispatcher };
    const res = mockRes();
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(res.code).toBeUndefined();
  });

  it('responds 403 authorization-denied when not authorized', () => {
    const mw = requireAuthorization(Action.Create, () => ({
      type: ResourceType.Driver,
    }));
    const req: AuthorizedRequest = { principal: dispatcher };
    const res = mockRes();
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.code).toBe(403);
    expect((res.body as { error: string }).error).toBe(
      ErrorCode.AuthorizationDenied,
    );
  });

  it('responds 401 when there is no authenticated principal', () => {
    const mw = requireAuthorization(Action.Read, () => ({
      type: ResourceType.Delivery,
    }));
    const req: AuthorizedRequest = {};
    const res = mockRes();
    mw(req, res, () => undefined);
    expect(res.code).toBe(401);
  });
});
