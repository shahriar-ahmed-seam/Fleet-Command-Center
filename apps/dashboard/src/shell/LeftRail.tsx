import React from 'react';
import { routesForRole, type Role, type RouteId } from '../auth/rbac';

const ROUTE_META: Record<RouteId, { label: string; glyph: string }> = {
  map: { label: 'Live Map', glyph: '◎' },
  deliveries: { label: 'Deliveries', glyph: '⬚' },
  drivers: { label: 'Drivers', glyph: '☖' },
  vehicles: { label: 'Vehicles', glyph: '⛟' },
  zones: { label: 'Zones', glyph: '⬡' },
  reports: { label: 'Reports', glyph: '◷' },
};

export interface LeftRailProps {
  role: Role;
  active: RouteId | null;
  onNavigate: (route: RouteId) => void;
  
  footer?: React.ReactNode;
}

/** The RBAC-aware left navigation rail. */
export function LeftRail({
  role,
  active,
  onNavigate,
  footer,
}: LeftRailProps): React.ReactElement {
  const routes = routesForRole(role);
  return (
    <nav
      aria-label="Primary"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 232,
        flex: '0 0 auto',
        background: 'var(--glass-bg-strong)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderRight: '1px solid var(--glass-border)',
        padding: 'var(--space-4) var(--space-3)',
        gap: 'var(--space-1)',
        overflow: 'auto',
        zIndex: 4,
      }}
    >
      {routes.map((r) => {
        const meta = ROUTE_META[r];
        const isActive = r === active;
        return (
          <button
            key={r}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(r)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-control)',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
              background: isActive ? 'var(--color-surface-alt)' : 'transparent',
              borderLeft: `3px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            <span aria-hidden="true" style={{ width: 18, textAlign: 'center', fontSize: 16 }}>
              {meta.glyph}
            </span>
            {meta.label}
          </button>
        );
      })}
      {footer && <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>{footer}</div>}
    </nav>
  );
}
