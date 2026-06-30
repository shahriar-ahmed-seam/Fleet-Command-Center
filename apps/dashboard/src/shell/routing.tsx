import React from 'react';
import {
  canAccess,
  defaultRouteForRole,
  type Role,
  type RouteId,
} from '../auth/rbac';

const ALL_ROUTES: RouteId[] = [
  'map',
  'deliveries',
  'drivers',
  'vehicles',
  'zones',
  'reports',
];

function parseHash(): RouteId | null {
  const raw = (typeof location !== 'undefined' ? location.hash : '')
    .replace(/^#\/?/, '')
    .split('?')[0];
  return (ALL_ROUTES as string[]).includes(raw) ? (raw as RouteId) : null;
}


export function resolveRoute(
  requested: RouteId | null,
  role: Role,
): RouteId | null {
  if (requested && canAccess(role, requested)) return requested;
  return defaultRouteForRole(role);
}

export interface RouterValue {
  route: RouteId | null;
  navigate: (route: RouteId) => void;
}

/**
 * Hook driving RBAC-aware routing from `location.hash`. Returns the resolved
 * (authorized) active route and a `navigate` function.
 */
export function useHashRoute(role: Role): RouterValue {
  const [requested, setRequested] = React.useState<RouteId | null>(parseHash);

  React.useEffect(() => {
    const onHash = () => setRequested(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const route = resolveRoute(requested, role);

  // Keep the URL hash in sync with the resolved route (handles redirects).
  React.useEffect(() => {
    if (route && parseHash() !== route) {
      location.hash = `/${route}`;
    }
  }, [route]);

  const navigate = React.useCallback(
    (next: RouteId) => {
      if (canAccess(role, next)) location.hash = `/${next}`;
    },
    [role],
  );

  return { route, navigate };
}
