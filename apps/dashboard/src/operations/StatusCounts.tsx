import React from 'react';
import { StatCard } from '../components';
import { driverStatusVar, deliveryStatusVar } from '../theme/tokens';
import { countByStatus } from './counts';

export interface StatusCountsProps<T> {
  items: readonly T[];
  statusOf: (item: T) => string;
  /** Canonical, ordered status list (every status renders, zero-filled). */
  order: readonly string[];
  /** Which palette to draw accents from. */
  kind: 'driver' | 'delivery';
  /** Currently selected status filter, if any. */
  selected?: string | null;
  /** Toggle a status filter. */
  onSelect?: (status: string | null) => void;
}

/** A responsive row of status count tiles. */
export function StatusCounts<T>({
  items,
  statusOf,
  order,
  kind,
  selected,
  onSelect,
}: StatusCountsProps<T>): React.ReactElement {
  const { byStatus } = countByStatus(items, statusOf, order);
  const accentVar = kind === 'driver' ? driverStatusVar : deliveryStatusVar;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 'var(--space-2)',
      }}
    >
      {order.map((status) => (
        <StatCard
          key={status}
          label={status.replace(/_/g, ' ')}
          value={byStatus[status] ?? 0}
          accent={accentVar(status)}
          active={selected === status}
          onClick={
            onSelect ? () => onSelect(selected === status ? null : status) : undefined
          }
        />
      ))}
    </div>
  );
}
