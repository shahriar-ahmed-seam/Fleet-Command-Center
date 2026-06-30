import React from 'react';

const CONTROL_BASE: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 var(--space-3)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-control)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--font-size-sm)',
  outline: 'none',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
};

function invalidStyle(invalid?: boolean): React.CSSProperties {
  return invalid
    ? { borderColor: 'var(--color-danger)', boxShadow: '0 0 0 1px var(--color-danger)' }
    : {};
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** A token-styled text input. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ invalid, style, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        style={{ ...CONTROL_BASE, ...invalidStyle(invalid), ...style }}
        {...rest}
      />
    );
  },
);

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** A token-styled select control. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ invalid, style, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        style={{
          ...CONTROL_BASE,
          appearance: 'none',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239AA7B8' d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right var(--space-3) center',
          paddingRight: 'var(--space-6)',
          cursor: 'pointer',
          ...invalidStyle(invalid),
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

let fieldSeq = 0;
function useFieldId(provided?: string): string {
  return React.useMemo(() => provided ?? `field-${++fieldSeq}`, [provided]);
}

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  /** Inline validation error; when present the control is flagged invalid. */
  error?: string | null;
  /** Helper text shown when there is no error. */
  hint?: string;
  required?: boolean;
  /** Render-prop receiving the wiring props for the control. */
  children: (props: {
    id: string;
    invalid: boolean;
    'aria-describedby'?: string;
  }) => React.ReactNode;
}

/**
 * Labelled form field that wires validation messaging to its control. The
 * message names the offending field inline and is associated for assistive tech.
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: FormFieldProps): React.ReactElement {
  const id = useFieldId(htmlFor);
  const msgId = `${id}-msg`;
  const invalid = Boolean(error);
  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 500,
          color: 'var(--color-text)',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </label>
      {children({ id, invalid, 'aria-describedby': error || hint ? msgId : undefined })}
      {(error || hint) && (
        <span
          id={msgId}
          role={error ? 'alert' : undefined}
          style={{
            fontSize: 'var(--font-size-xs)',
            color: error ? 'var(--color-danger)' : 'var(--color-text-muted)',
          }}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  );
}
