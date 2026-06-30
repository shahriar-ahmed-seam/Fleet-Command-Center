import React from 'react';
import { ConnectionIndicator } from '../components';
import type { ConnectionState } from '../realtime/socketClient';
import { routesForRole, type Role, type RouteId } from '../auth/rbac';

const ROUTE_LABEL: Record<RouteId, string> = {
  map: 'Worldwide',
  deliveries: 'Deliveries',
  drivers: 'Drivers',
  vehicles: 'Vehicles',
  zones: 'Zones',
  reports: 'Reports',
};

export interface TopNavProps {
  connection: ConnectionState;
  role: Role;
  active: RouteId | null;
  onNavigate: (route: RouteId) => void;
  userName?: string;
  onHome?: () => void;
  simulation?: boolean;
}

/** Top navigation: brand mark, a glass pill of route tabs, and the user cluster. */
export function TopNav({
  connection,
  role,
  active,
  onNavigate,
  userName = 'Sam Rowe',
  onHome,
  simulation = false,
}: TopNavProps): React.ReactElement {
  const routes = routesForRole(role);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        height: 64,
        padding: '0 var(--space-5)',
        background: 'var(--glass-bg-strong)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--glass-border)',
        flex: '0 0 auto',
        zIndex: 6,
      }}
    >
      <button
        type="button"
        onClick={onHome}
        aria-label="Back to home"
        style={{
          flex: '0 0 auto',
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'var(--radius-control)',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          color: 'var(--color-bg)',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: 20,
          boxShadow: '0 0 14px color-mix(in srgb, var(--color-primary) 50%, transparent)',
        }}
      >
        ◈
      </button>

      {/* Pill tab group */}
      <nav
        aria-label="Primary"
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: 4,
          borderRadius: 'var(--radius-pill)',
        }}
      >
        {routes.map((r) => {
          const isActive = r === active;
          return (
            <button
              key={r}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(r)}
              style={{
                height: 34,
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-pill)',
                border: isActive
                  ? '1px solid color-mix(in srgb, var(--color-primary) 70%, transparent)'
                  : '1px solid transparent',
                background: isActive
                  ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                  : 'transparent',
                color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive
                  ? '0 0 16px color-mix(in srgb, var(--color-primary) 35%, transparent)'
                  : 'none',
                transition: 'color 140ms ease, background 140ms ease',
              }}
            >
              {ROUTE_LABEL[r]}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {simulation && (
          <span
            title="Running on the in-browser fleet simulation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 var(--space-3)',
              borderRadius: 'var(--radius-pill)',
              background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
              color: 'var(--color-accent)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
            }}
          >
            ◈ Simulation
          </span>
        )}
        <ConnectionIndicator state={connection} />
        <IconButton label="Search deliveries" onClick={() => onNavigate('deliveries')} glyph="⌕" />
        <IconButton label="Notifications" glyph="◔" dot />
        <ProfileChip name={userName} role={role} />
      </div>
    </header>
  );
}

function IconButton({
  label,
  glyph,
  onClick,
  dot = false,
}: {
  label: string;
  glyph: string;
  onClick?: () => void;
  dot?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="glass"
      style={{
        position: 'relative',
        width: 38,
        height: 38,
        borderRadius: '50%',
        color: 'var(--color-text)',
        fontSize: 16,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {glyph}
      {dot && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 9,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            boxShadow: '0 0 0 2px var(--color-surface)',
          }}
        />
      )}
    </button>
  );
}

function ProfileChip({ name, role }: { name: string; role: Role }): React.ReactElement {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <button
      type="button"
      className="glass"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: 44,
        padding: '0 var(--space-3) 0 5px',
        borderRadius: 'var(--radius-pill)',
        color: 'var(--color-text)',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-info))',
          color: 'var(--color-bg)',
          fontWeight: 700,
          fontSize: 'var(--font-size-sm)',
        }}
      >
        {initials}
      </span>
      <span style={{ lineHeight: 1.15, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{name}</span>
        <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{role}</span>
      </span>
      <span aria-hidden="true" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>▾</span>
    </button>
  );
}
