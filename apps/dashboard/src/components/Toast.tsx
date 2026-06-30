import React from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: React.ReactNode;
}

interface ToastApi {
  push: (message: React.ReactNode, tone?: ToastTone, ttlMs?: number) => number;
  dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const TONE_COLOR: Record<ToastTone, string> = {
  info: 'var(--color-info)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
};

let toastSeq = 0;

/** Provides the toast API and renders the toast stack. */
export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = React.useCallback(
    (message: React.ReactNode, tone: ToastTone = 'info', ttlMs = 5000) => {
      const id = ++toastSeq;
      setToasts((t) => [...t, { id, tone, message }]);
      if (ttlMs > 0) window.setTimeout(() => dismiss(id), ttlMs);
      return id;
    },
    [dismiss],
  );

  const api = React.useMemo<ToastApi>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          right: 'var(--space-5)',
          bottom: 'var(--space-5)',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          maxWidth: 380,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderLeft: `3px solid ${TONE_COLOR[t.tone]}`,
              borderRadius: 'var(--radius-control)',
              boxShadow: 'var(--shadow-md)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              animation: 'fcc-fade-in 140ms ease',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                marginTop: 5,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: TONE_COLOR[t.tone],
                flex: '0 0 auto',
              }}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Access the toast API; throws if used outside a ToastProvider. */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
