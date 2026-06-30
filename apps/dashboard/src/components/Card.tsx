import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevation shadow token. */
  elevation?: 'sm' | 'md' | 'lg' | 'none';
  /** Inner padding step (spacing scale). Defaults to 16px. */
  padding?: 1 | 2 | 3 | 4 | 5 | 6;
}

/** A tokened, elevated content surface. */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = 'sm', padding = 4, style, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: elevation === 'none' ? 'none' : 'var(--glass-shadow)',
        padding: `var(--space-${padding})`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});

export interface PanelProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  /** Right-aligned actions in the header row. */
  actions?: React.ReactNode;
  /** Removes body padding (e.g. for tables/maps that manage their own). */
  flush?: boolean;
}

/** A surface with a header row and a body region. */
export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { title, actions, flush = false, style, children, ...rest },
  ref,
) {
  return (
    <section
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--glass-shadow)',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {(title || actions) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              letterSpacing: 0.2,
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            {title}
          </div>
          {actions && <div style={{ display: 'flex', gap: 'var(--space-2)' }}>{actions}</div>}
        </header>
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: flush ? 0 : 'var(--space-4)',
        }}
      >
        {children}
      </div>
    </section>
  );
});
