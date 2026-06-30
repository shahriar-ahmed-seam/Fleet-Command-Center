export type Role = 'Administrator' | 'Dispatcher' | 'Driver' | 'Customer';

/** Logical routes/views in the dashboard. */
export type RouteId =
  | 'map'
  | 'deliveries'
  | 'drivers'
  | 'vehicles'
  | 'zones'
  | 'reports';


export const ROUTE_PERMISSIONS: Record<RouteId, Role[]> = {
  map: ['Administrator', 'Dispatcher'],
  deliveries: ['Administrator', 'Dispatcher'],
  drivers: ['Administrator'],
  vehicles: ['Administrator'],
  zones: ['Administrator'],
  reports: ['Administrator', 'Dispatcher'],
};

/** True iff `role` may access `route` per the permission matrix. */
export function canAccess(role: Role, route: RouteId): boolean {
  return ROUTE_PERMISSIONS[route].includes(role);
}

/** The ordered list of routes a role may access (drives the left rail). */
export function routesForRole(role: Role): RouteId[] {
  return (Object.keys(ROUTE_PERMISSIONS) as RouteId[]).filter((r) =>
    canAccess(role, r),
  );
}

/** The default landing route for a role (first accessible route). */
export function defaultRouteForRole(role: Role): RouteId | null {
  return routesForRole(role)[0] ?? null;
}
