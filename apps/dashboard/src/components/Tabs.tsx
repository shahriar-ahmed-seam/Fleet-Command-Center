import React from 'react';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  /** Optional trailing count/badge. */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
}

/** A token-styled tab strip. */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
}: TabsProps): React.ReactElement {
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.id);
  const active = value ?? internal;

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  };

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 'var(--space-1)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => select(item.id)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
              transition: 'color 120ms ease',
            }}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--color-text-muted)',
                }}
              >
                {item.count}
              </span>
            )}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 'var(--space-3)',
                right: 'var(--space-3)',
                bottom: -1,
                height: 2,
                borderRadius: 2,
                background: isActive ? 'var(--color-primary)' : 'transparent',
                transition: 'background 120ms ease',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
