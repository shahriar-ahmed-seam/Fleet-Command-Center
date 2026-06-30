import React from 'react';
import { BrandLogo } from '../brand';
import { ConnectionIndicator } from '../components';
import type { ConnectionState } from '../realtime/socketClient';
import type { Role } from '../auth/rbac';

export interface TopNavProps {
  connection: ConnectionState;
  role: Role;
  userName?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  onHome?: () => void;
  simulation?: boolean;
}

/** The dashboard's top navigation bar. */
export function TopNav({
  connection,
  role,
  userName = 'Operator',
  search,
  onSearchChange,
  onSearchSubmit,
  onHome,
  simulation = false,
}: TopNavProps): React.ReactElement {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        height: 60,
        padding: '0 var(--space-5)',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        flex: '0 0 auto',
      }}
    >
      <button
        type="button"
        onClick={onHome}
        aria-label="Back to home"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: onHome ? 'pointer' : 'default',
        }}
      >
        <BrandLogo />
      </button>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit?.(search);
        }}
        style={{ flex: '1 1 auto', maxWidth: 420 }}
      >
        <div style={{ position: 'relative' }}>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 'var(--space-3)',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            ⌕
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search deliveries by ID or recipient"
            aria-label="Search deliveries by identifier or recipient"
            style={{
              width: '100%',
              height: 38,
              padding: '0 var(--space-3) 0 var(--space-6)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 'var(--font-size-sm)',
              outline: 'none',
            }}
          />
        </div>
      </form>

      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {simulation && (
          <span
            title="Running on the in-browser fleet simulation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 var(--space-3)',
              borderRadius: 'var(--radius-pill)',
              background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
              color: 'var(--color-accent)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            ◈ Simulation
          </span>
        )}
        <ConnectionIndicator state={connection} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              color: 'var(--color-text)',
            }}
          >
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{userName}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {role}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
