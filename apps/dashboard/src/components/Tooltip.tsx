import React from 'react';

export interface TooltipProps {
  label: React.ReactNode;
  placement?: 'top' | 'bottom';
  children: React.ReactElement;
}

let tipSeq = 0;

/** Wraps a trigger element with an accessible tooltip. */
export function Tooltip({
  label,
  placement = 'top',
  children,
}: TooltipProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const id = React.useMemo(() => `tip-${++tipSeq}`, []);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {React.cloneElement(children, { 'aria-describedby': id })}
      <span
        role="tooltip"
        id={id}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          [placement === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)',
          padding: 'var(--space-1) var(--space-2)',
          background: 'var(--color-surface-alt)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-control)',
          boxShadow: 'var(--shadow-md)',
          fontSize: 'var(--font-size-xs)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: open ? 1 : 0,
          transition: 'opacity 120ms ease',
          zIndex: 1200,
        }}
      >
        {label}
      </span>
    </span>
  );
}
