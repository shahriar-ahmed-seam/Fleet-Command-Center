import React from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Footer actions (e.g. Cancel / Confirm buttons). */
  footer?: React.ReactNode;
  /** Max width of the dialog in pixels. */
  width?: number;
  children?: React.ReactNode;
}

/** A controlled, accessible modal dialog. */
export function Modal({
  open,
  onClose,
  title,
  footer,
  width = 520,
  children,
}: ModalProps): React.ReactElement | null {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog on open.
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-5)',
        background: 'rgba(5, 9, 15, 0.6)',
        backdropFilter: 'blur(2px)',
        animation: 'fcc-fade-in 120ms ease',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: width,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-modal)',
          boxShadow: 'var(--shadow-lg)',
          outline: 'none',
        }}
      >
        {title && (
          <header
            style={{
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
            }}
          >
            {title}
          </header>
        )}
        <div style={{ padding: 'var(--space-5)', overflow: 'auto' }}>{children}</div>
        {footer && (
          <footer
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)',
              padding: 'var(--space-4) var(--space-5)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
