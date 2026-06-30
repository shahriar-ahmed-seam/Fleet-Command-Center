import React from 'react';
import { TopNav } from './TopNav';
import { useHashRoute } from './routing';
import type { Role, RouteId } from '../auth/rbac';
import { SocketClient } from '../realtime/socketClient';
import { useConnectionState } from '../realtime/useConnection';
import { MapView } from '../map/MapView';
import { useFleetState } from '../map/useFleetState';
import {
  ActivityFeed,
  DriversView,
  DeliveriesView,
  useOperationsState,
  type VehiclePosition,
} from '../operations';
import { VehiclesView } from '../views/VehiclesView';
import { ZonesView } from '../views/ZonesView';
import { ReportsView } from '../views/ReportsView';
import { simulationTransportFactory } from '../sim/simulationTransport';

export interface AppShellProps {
  role: Role;
  userName?: string;
  /** Streaming service WebSocket URL (used when not in simulation mode). */
  streamingUrl?: string;
  token?: string;
  /** When true, live data is produced by the in-browser fleet simulation. */
  simulation?: boolean;
  /** Navigate back to the landing view. */
  onHome?: () => void;
}

/** The composed dashboard shell. */
export function AppShell({
  role,
  userName,
  streamingUrl = 'ws://localhost:4000/stream',
  token,
  simulation = false,
  onHome,
}: AppShellProps): React.ReactElement {
  const clientRef = React.useRef<SocketClient | null>(null);
  if (clientRef.current === null && typeof window !== 'undefined') {
    clientRef.current = new SocketClient({
      url: simulation ? 'sim://local' : streamingUrl,
      token,
      transportFactory: simulation ? simulationTransportFactory : undefined,
    });
  }
  const client = clientRef.current;
  React.useEffect(() => () => client?.disconnect(), [client]);

  const connection = useConnectionState(client);
  const { route, navigate } = useHashRoute(role);
  const [search, setSearch] = React.useState('');
  const fleet = useFleetState(client);
  const ops = useOperationsState();

  const positions = React.useMemo<VehiclePosition[]>(
    () => fleet.vehicles.map((v) => ({ vehicleId: v.vehicleId, lat: v.lat, lng: v.lng })),
    [fleet.vehicles],
  );

  const renderRoute = (r: RouteId | null): React.ReactNode => {
    switch (r) {
      case 'map':
        return (
          <div style={{ position: 'relative', height: '100%' }}>
            <MapView
              vehicles={fleet.vehicles}
              zones={fleet.zones}
              tracesByVehicle={fleet.tracesByVehicle}
            />
            <div
              style={{
                position: 'absolute',
                top: 'var(--space-4)',
                right: 'var(--space-4)',
                bottom: 'var(--space-4)',
                width: 300,
                display: 'flex',
              }}
            >
              <ActivityFeed client={client} height="100%" />
            </div>
          </div>
        );
      case 'deliveries':
        return (
          <DeliveriesView
            deliveries={ops.deliveries}
            query={search}
            onQueryChange={setSearch}
          />
        );
      case 'drivers':
        return (
          <DriversView
            drivers={ops.drivers}
            deliveries={ops.deliveries}
            assignments={ops.assignments}
            routes={ops.routes}
            positions={positions}
          />
        );
      case 'vehicles':
        return <VehiclesView vehicles={fleet.vehicles} drivers={ops.drivers} />;
      case 'zones':
        return <ZonesView zones={fleet.zones} vehicles={fleet.vehicles} />;
      case 'reports':
        return <ReportsView drivers={ops.drivers} deliveries={ops.deliveries} />;
      default:
        return <MapView vehicles={fleet.vehicles} zones={fleet.zones} tracesByVehicle={fleet.tracesByVehicle} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 1280 }}>
      <TopNav
        connection={connection}
        role={role}
        active={route}
        onNavigate={navigate}
        userName={userName}
        onHome={onHome}
        simulation={simulation}
      />
      <main style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {renderRoute(route)}
      </main>
    </div>
  );
}
