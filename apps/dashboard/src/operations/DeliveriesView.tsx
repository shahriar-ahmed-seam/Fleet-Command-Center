import React from 'react';
import { Badge, Input, Panel, Table, type Column } from '../components';
import { StatusCounts } from './StatusCounts';
import { DELIVERY_STATUS_ORDER } from './counts';
import { searchDeliveries } from './search';
import type { DeliveryRecord } from './types';

export interface DeliveriesViewProps {
  deliveries: DeliveryRecord[];
  /** Search query driven from the global top-nav search box. */
  query?: string;
  onQueryChange?: (q: string) => void;
}

/** Deliveries console: counts and a searchable table. */
export function DeliveriesView({
  deliveries,
  query = '',
  onQueryChange,
}: DeliveriesViewProps): React.ReactElement {
  const [local, setLocal] = React.useState(query);
  React.useEffect(() => setLocal(query), [query]);

  const [filter, setFilter] = React.useState<string | null>(null);

  const q = local.trim();
  const base = q !== '' ? searchDeliveries(deliveries, q) : deliveries;
  const visible = filter ? base.filter((d) => d.status === filter) : base;

  const setQuery = (value: string) => {
    setLocal(value);
    onQueryChange?.(value);
  };

  const columns: Column<DeliveryRecord>[] = [
    {
      key: 'deliveryId',
      header: 'Delivery',
      accessor: (d) => d.deliveryId,
      sortable: true,
      render: (d) => <span className="mono">{d.deliveryId}</span>,
    },
    { key: 'recipient', header: 'Recipient', accessor: (d) => d.recipientName, sortable: true },
    { key: 'address', header: 'Destination', accessor: (d) => d.destinationAddress },
    {
      key: 'status',
      header: 'Status',
      accessor: (d) => d.status,
      sortable: true,
      render: (d) => <Badge deliveryStatus={d.status} subtle>{d.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'assignment',
      header: 'Assignment',
      accessor: (d) => d.assignmentId ?? '—',
      render: (d) => <span className="mono">{d.assignmentId ?? '—'}</span>,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <StatusCounts
        items={deliveries}
        statusOf={(d) => d.status}
        order={DELIVERY_STATUS_ORDER}
        kind="delivery"
        selected={filter}
        onSelect={setFilter}
      />
      <Panel
        title="Deliveries"
        flush
        style={{ flex: 1, minHeight: 0 }}
        actions={
          <div style={{ width: 260 }}>
            <Input
              placeholder="Search by ID or recipient…"
              value={local}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search deliveries"
            />
          </div>
        }
      >
        <Table
          columns={columns}
          rows={visible}
          rowKey={(d) => d.deliveryId}
          emptyMessage={q !== '' ? `No deliveries match “${q}”` : 'No deliveries'}
        />
      </Panel>
    </div>
  );
}
