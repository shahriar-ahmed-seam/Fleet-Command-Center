import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  /** Optional leading icon (rendered before the label). */
  icon?: React.ReactNode;
  /** Stretches the button to the full width of its container. */
  block?: boolean;
}

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: 'var(--color-primary)',
        color: '#FFFFFF',
        border: '1px solid transparent',
      };
    case 'danger':
      return {
        background: 'var(--color-danger)',
        color: '#FFFFFF',
        border: '1px solid transparent',
      };
    case 'secondary':
      return {
        background: 'var(--color-surface-alt)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--color-text)',
        border: '1px solid transparent',
      };
  }
}

const SIZE: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 32, padding: '0 var(--space-3)', fontSize: 'var(--font-size-sm)' },
  md: { height: 40, padding: '0 var(--space-4)', fontSize: 'var(--font-size-sm)' },
};

/** A token-styled, accessible button with intent variants and loading state. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      block = false,
      disabled,
      style,
      children,
      onMouseEnter,
      onMouseLeave,
      ...rest
    },
    ref,
  ) {
    const [hover, setHover] = React.useState(false);
    const isDisabled = disabled || loading;
    const base = variantStyle(variant);

    const hoverOverlay: React.CSSProperties =
      hover && !isDisabled
        ? variant === 'primary'
          ? { background: 'var(--color-primary-hover)' }
          : variant === 'ghost'
            ? { background: 'var(--color-surface-alt)' }
            : { filter: 'brightness(1.08)' }
        : {};

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        onMouseEnter={(e) => {
          setHover(true);
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setHover(false);
          onMouseLeave?.(e);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          width: block ? '100%' : undefined,
          borderRadius: 'var(--radius-control)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled && !loading ? 0.5 : 1,
          transition: 'background 120ms ease, filter 120ms ease, opacity 120ms ease',
          whiteSpace: 'nowrap',
          ...SIZE[size],
          ...base,
          ...hoverOverlay,
          ...style,
        }}
        {...rest}
      >
        {loading && (
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              animation: 'fcc-spin 0.7s linear infinite',
            }}
          />
        )}
        {!loading && icon}
        {children}
      </button>
    );
  },
);
