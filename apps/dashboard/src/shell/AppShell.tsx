import React from 'react';
import { TopNav } from './TopNav';
import { LeftRail } from './LeftRail';
import { useHashRoute } from './routing';
import type { Role, RouteId } from '../auth/rbac';
import { SocketClient } from '../realtime/socketClient';
import { useConnectionState } from '../realtime/useConnection';
import { MapView } from '../map/MapView';
import { useFleetState } from '../map/useFleetState';
import { Panel } from '../components/Card';
import {
  ActivityFeed,
  DriversView,
  DeliveriesView,
  useOperationsState,
  type VehiclePosition,
} from '../operations';

export interface AppShellProps {
  role: Role;
  userName?: string;
  /** Streaming_Service WebSocket URL. */
  streamingUrl?: string;
  
  token?: string;
}

/** Placeholder for views delivered in later tasks, styled on-brand. */
function ComingSoon({ title }: { title: string }): React.ReactElement {
  return (
    <div style={{ padding: 'var(--space-5)', height: '100%' }}>
      <Panel title={title}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          This view is part of the dispatch console and is delivered in a later task.
        </p>
      </Panel>
    </div>
  );
}

/** The composed dashboard shell. */
export function AppShell({
  role,
  userName,
  streamingUrl = 'ws://localhost:4000/stream',
  token,
}: AppShellProps): React.ReactElement {
  // One SocketClient for the app lifetime.
  const clientRef = React.useRef<SocketClient | null>(null);
  if (clientRef.current === null && typeof window !== 'undefined') {
    clientRef.current = new SocketClient({ url: streamingUrl, token });
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
                width: 320,
                maxHeight: 'calc(100% - var(--space-4) * 2)',
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
        return <ComingSoon title="Vehicles" />;
      case 'zones':
        return <ComingSoon title="Zones" />;
      case 'reports':
        return <ComingSoon title="Reports" />;
      default:
        return <ComingSoon title="Dashboard" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 1280 }}>
      <TopNav
        connection={connection}
        role={role}
        userName={userName}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => navigate('deliveries')}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <LeftRail role={role} active={route} onNavigate={navigate} />
        <main style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {renderRoute(route)}
        </main>
      </div>
    </div>
  );
}
