import { ErrorCode, makeError, type ErrorEnvelope } from '@fleet/contracts';

import { Role } from './roles';

/** The resource types guarded by the management path. */
export enum ResourceType {
  Driver = 'Driver',
  Vehicle = 'Vehicle',
  Zone = 'Zone',
  Delivery = 'Delivery',
  Assignment = 'Assignment',
}

/** The actions a principal may attempt against a resource. */
export enum Action {
  Create = 'create',
  Update = 'update',
  Deactivate = 'deactivate',
  Read = 'read',
}

/** The authenticated caller, derived from the verified session token. */
export interface Principal {
  role: Role;
  /** The user id; for a Driver this is the id ownership is checked against. */
  userId?: string;
  
  trackingScope?: string;
}

/** A reference to the resource being accessed, with ownership/scope context. */
export interface ResourceRef {
  type: ResourceType;
  
  ownerDriverId?: string;
  
  deliveryId?: string;
}

/** The outcome of an authorization check. */
export type AuthDecision =
  | { allowed: true }
  | { allowed: false; error: ErrorEnvelope };

const ALLOW: AuthDecision = { allowed: true };

function deny(): AuthDecision {
  return { allowed: false, error: makeError(ErrorCode.AuthorizationDenied) };
}

/** The administrative write actions (create/update/deactivate). */
const WRITE_ACTIONS: ReadonlySet<Action> = new Set([
  Action.Create,
  Action.Update,
  Action.Deactivate,
]);

/** Resource types only an Administrator may create/update/deactivate (13.3). */
const ADMIN_MANAGED: ReadonlySet<ResourceType> = new Set([
  ResourceType.Driver,
  ResourceType.Vehicle,
  ResourceType.Zone,
]);

/** Resource types Administrators and Dispatchers may create (13.4). */
const DISPATCHABLE: ReadonlySet<ResourceType> = new Set([
  ResourceType.Delivery,
  ResourceType.Assignment,
]);


export function authorize(
  principal: Principal,
  action: Action,
  resource: ResourceRef,
): AuthDecision {
  switch (principal.role) {
    case Role.Administrator:
      // Administrators have full management authority over every resource.
      return ALLOW;

    case Role.Dispatcher:
      return authorizeDispatcher(action, resource);

    case Role.Driver:
      return authorizeDriver(principal, action, resource);

    case Role.Customer:
      return authorizeCustomer(principal, action, resource);

    default:
      return deny();
  }
}


function authorizeDispatcher(
  action: Action,
  resource: ResourceRef,
): AuthDecision {
  if (action === Action.Read) return ALLOW;
  if (action === Action.Create && DISPATCHABLE.has(resource.type)) {
    return ALLOW;
  }
  // Any write to an admin-managed resource, or create of a non-dispatchable
  // resource, is denied.
  return deny();
}


function authorizeDriver(
  principal: Principal,
  action: Action,
  resource: ResourceRef,
): AuthDecision {
  if (action !== Action.Read) return deny();
  const ownable =
    resource.type === ResourceType.Assignment ||
    resource.type === ResourceType.Delivery;
  if (!ownable) return deny();
  if (
    principal.userId !== undefined &&
    resource.ownerDriverId === principal.userId
  ) {
    return ALLOW;
  }
  return deny();
}


function authorizeCustomer(
  principal: Principal,
  action: Action,
  resource: ResourceRef,
): AuthDecision {
  if (action !== Action.Read) return deny();
  if (resource.type !== ResourceType.Delivery) return deny();
  if (
    principal.trackingScope !== undefined &&
    resource.deliveryId !== undefined &&
    principal.trackingScope === `delivery:${resource.deliveryId}`
  ) {
    return ALLOW;
  }
  return deny();
}

/**
 * Express/NestJS-style middleware factory: enforces `authorize` for a fixed
 * (action, resource-resolver) and responds 403 with the authorization-denied
 * envelope when denied. The resource resolver derives ownership/scope context
 * from the request so route handlers stay free of authorization logic.
 */
export function requireAuthorization(
  action: Action,
  resolveResource: (req: AuthorizedRequest) => ResourceRef,
) {
  return (
    req: AuthorizedRequest,
    res: AuthResponse,
    next: () => void,
  ): void => {
    const principal = req.principal;
    if (!principal) {
      res.status(401).json(makeError(ErrorCode.AuthenticationFailed));
      return;
    }
    const decision = authorize(principal, action, resolveResource(req));
    if (!decision.allowed) {
      res.status(403).json(decision.error);
      return;
    }
    next();
  };
}

/** Minimal request/response shapes the middleware depends on. */
export interface AuthorizedRequest {
  principal?: Principal;
  [key: string]: unknown;
}

export interface AuthResponse {
  status(code: number): AuthResponse;
  json(body: unknown): void;
}
