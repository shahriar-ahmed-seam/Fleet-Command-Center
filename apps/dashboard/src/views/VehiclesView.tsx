import React from 'react';
import { Badge, Panel, StatCard, Table, type Column } from '../components';
import { driverStatusVar } from '../theme/tokens';
import type { VehicleState } from '../map/geo';
import type { DriverRecord } from '../operations';

export interface VehiclesViewProps {
  vehicles: VehicleState[];
  drivers: DriverRecord[];
}

interface Row {
  vehicleId: string;
  driver: string;
  status: string;
  heading: number | null;
  lat: number;
  lng: number;
}

const STATUSES = ['Available', 'On_Delivery', 'On_Break', 'Offline'];

/** Live fleet roster: every vehicle with its driver, status, and position. */
export function VehiclesView({ vehicles, drivers }: VehiclesViewProps): React.ReactElement {
  const driverByVehicle = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const d of drivers) if (d.vehicleId) m.set(d.vehicleId, d.name);
    return m;
  }, [drivers]);

  const rows: Row[] = vehicles.map((v) => ({
    vehicleId: v.vehicleId,
    driver: driverByVehicle.get(v.vehicleId) ?? 'Unassigned',
    status: v.driverStatus,
    heading: v.heading ?? null,
    lat: v.lat,
    lng: v.lng,
  }));

  const counts = STATUSES.map((s) => ({
    status: s,
    n: vehicles.filter((v) => v.driverStatus === s).length,
  }));

  const columns: Column<Row>[] = [
    {
      key: 'vehicleId',
      header: 'Vehicle',
      accessor: (r) => r.vehicleId,
      sortable: true,
      render: (r) => <span className="mono">{r.vehicleId}</span>,
    },
    { key: 'driver', header: 'Driver', accessor: (r) => r.driver, sortable: true },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => r.status,
      sortable: true,
      render: (r) => <Badge driverStatus={r.status} subtle>{r.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'heading',
      header: 'Heading',
      accessor: (r) => r.heading ?? -1,
      render: (r) => (r.heading == null ? '—' : <span className="mono">{r.heading}°</span>),
    },
    {
      key: 'position',
      header: 'Position',
      accessor: (r) => r.lat,
      render: (r) => (
        <span className="mono" style={{ color: 'var(--color-text-muted)' }}>
          {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
        </span>
      ),
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-2)' }}>
        <StatCard label="Total vehicles" value={vehicles.length} />
        {counts.map((c) => (
          <StatCard key={c.status} label={c.status.replace(/_/g, ' ')} value={c.n} accent={driverStatusVar(c.status)} />
        ))}
      </div>
      <Panel title="Fleet roster · live" flush style={{ flex: 1, minHeight: 0 }}>
        <Table columns={columns} rows={rows} rowKey={(r) => r.vehicleId} emptyMessage="No vehicles reporting" />
      </Panel>
    </div>
  );
}
