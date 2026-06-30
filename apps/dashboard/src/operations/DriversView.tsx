import React from 'react';
import { Badge, Panel, Table, type Column } from '../components';
import { StatusCounts } from './StatusCounts';
import { DRIVER_STATUS_ORDER } from './counts';
import { buildDriverDetail } from './driverDetail';
import type {
  AssignmentRecord,
  DeliveryRecord,
  DriverRecord,
  RouteRecord,
  VehiclePosition,
} from './types';

export interface DriversViewProps {
  drivers: DriverRecord[];
  deliveries: DeliveryRecord[];
  assignments: AssignmentRecord[];
  routes: RouteRecord[];
  positions: VehiclePosition[];
}

/** Drivers console: counts, roster table, and a live detail panel. */
export function DriversView({
  drivers,
  deliveries,
  assignments,
  routes,
  positions,
}: DriversViewProps): React.ReactElement {
  const [filter, setFilter] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const visible = React.useMemo(
    () => (filter ? drivers.filter((d) => d.status === filter) : drivers),
    [drivers, filter],
  );

  const detail = selectedId
    ? buildDriverDetail(selectedId, drivers, assignments, routes, deliveries, positions)
    : null;

  const columns: Column<DriverRecord>[] = [
    { key: 'name', header: 'Driver', accessor: (d) => d.name, sortable: true },
    {
      key: 'status',
      header: 'Status',
      accessor: (d) => d.status,
      sortable: true,
      render: (d) => <Badge driverStatus={d.status} subtle>{d.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      accessor: (d) => d.vehicleId ?? '—',
      render: (d) => <span className="mono">{d.vehicleId ?? '—'}</span>,
    },
    { key: 'contact', header: 'Contact', accessor: (d) => d.contact ?? '—' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minHeight: 0 }}>
        <StatusCounts
          items={drivers}
          statusOf={(d) => d.status}
          order={DRIVER_STATUS_ORDER}
          kind="driver"
          selected={filter}
          onSelect={setFilter}
        />
        <Panel title="Driver roster" flush style={{ flex: 1, minHeight: 0 }}>
          <Table
            columns={columns}
            rows={visible}
            rowKey={(d) => d.driverId}
            onRowClick={(d) => setSelectedId(d.driverId)}
            selectedKey={selectedId}
            emptyMessage="No drivers match this filter"
          />
        </Panel>
      </div>

      <DriverDetailPanel detail={detail} />
    </div>
  );
}

function DriverDetailPanel({
  detail,
}: {
  detail: ReturnType<typeof buildDriverDetail>;
}): React.ReactElement {
  if (!detail) {
    return (
      <Panel title="Driver detail">
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Select a driver to see their active assignment, route, and live position.
        </p>
      </Panel>
    );
  }

  const { driver, assignment, route, deliveries, position } = detail;

  return (
    <Panel title="Driver detail">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
            {driver.name}
          </div>
          <div style={{ marginTop: 'var(--space-1)' }}>
            <Badge driverStatus={driver.status} subtle>{driver.status.replace(/_/g, ' ')}</Badge>
          </div>
        </div>

        <DetailRow label="Vehicle" value={driver.vehicleId ?? '—'} mono />
        <DetailRow label="Contact" value={driver.contact ?? '—'} />

        <Section title="Active assignment">
          {assignment ? (
            <>
              <DetailRow label="Assignment" value={assignment.assignmentId} mono />
              <DetailRow
                label="Route"
                value={
                  route
                    ? `${route.stops.length} stop${route.stops.length === 1 ? '' : 's'}${route.optimized ? ' · optimized' : ' · unoptimized'}`
                    : '—'
                }
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                {deliveries.map((d) => (
                  <div
                    key={d.deliveryId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <span className="mono" style={{ color: 'var(--color-text-muted)' }}>
                      {d.deliveryId}
                    </span>
                    <Badge deliveryStatus={d.status} subtle>{d.status.replace(/_/g, ' ')}</Badge>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No active assignment.
            </p>
          )}
        </Section>

        <Section title="Live position">
          {position ? (
            <span className="mono" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No live position
            </span>
          )}
        </Section>
      </div>
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className={mono ? 'mono' : undefined} style={{ color: 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}
