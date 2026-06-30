import React from 'react';
import { DriverStatus } from '@fleet/contracts';
import { Select } from '../components/Input';
import { Badge } from '../components/Badge';
import { LiveMap, type ZonePolygon } from './LiveMap';
import { filterVehicles, type VehicleState, type TracePing } from './geo';

export interface MapViewProps {
  vehicles: VehicleState[];
  zones: ZonePolygon[];
  /** Trace pings keyed by vehicleId (only the selected one is rendered). */
  tracesByVehicle: Record<string, TracePing[]>;
}

const DRIVER_STATUSES = Object.values(DriverStatus);

/** The filterable live map view. */
export function MapView({
  vehicles,
  zones,
  tracesByVehicle,
}: MapViewProps): React.ReactElement {
  const [driverStatus, setDriverStatus] = React.useState<string | null>(null);
  const [zoneId, setZoneId] = React.useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(null);

  const shown = React.useMemo(
    () => filterVehicles(vehicles, { driverStatus, zoneId }),
    [vehicles, driverStatus, zoneId],
  );

  // Clear the selection if the selected vehicle is filtered out of view.
  React.useEffect(() => {
    if (selectedVehicleId && !shown.some((v) => v.vehicleId === selectedVehicleId)) {
      setSelectedVehicleId(null);
    }
  }, [shown, selectedVehicleId]);

  const tracePings = selectedVehicleId ? tracesByVehicle[selectedVehicleId] ?? [] : [];

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <LiveMap
        vehicles={shown}
        zones={zones}
        selectedVehicleId={selectedVehicleId}
        tracePings={tracePings}
        onSelectVehicle={setSelectedVehicleId}
      />

      {/* Floating filter controls */}
      <div
        className="glass"
        style={{
          position: 'absolute',
          top: 'var(--space-4)',
          left: 'var(--space-4)',
          zIndex: 2,
          display: 'flex',
          gap: 'var(--space-2)',
          padding: 'var(--space-3)',
        }}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Driver status
          </span>
          <Select
            value={driverStatus ?? ''}
            onChange={(e) => setDriverStatus(e.target.value || null)}
            style={{ width: 180, height: 34 }}
            aria-label="Filter by driver status"
          >
            <option value="">All statuses</option>
            {DRIVER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Zone
          </span>
          <Select
            value={zoneId ?? ''}
            onChange={(e) => setZoneId(e.target.value || null)}
            style={{ width: 180, height: 34 }}
            aria-label="Filter by zone"
          >
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {/* Status legend */}
      <div
        className="glass"
        style={{
          position: 'absolute',
          bottom: 'var(--space-4)',
          left: 'var(--space-4)',
          zIndex: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          maxWidth: 360,
          padding: 'var(--space-2) var(--space-3)',
        }}
      >
        {DRIVER_STATUSES.map((s) => (
          <Badge key={s} driverStatus={s}>
            {s.replace(/_/g, ' ')}
          </Badge>
        ))}
      </div>
    </div>
  );
}
