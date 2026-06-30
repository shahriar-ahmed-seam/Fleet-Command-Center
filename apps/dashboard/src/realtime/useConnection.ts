import React from 'react';
import type { ServerToClientEvents } from '@fleet/contracts';
import { SocketClient, type ConnectionState } from './socketClient';

/** Track the live connection state of a SocketClient. */
export function useConnectionState(client: SocketClient | null): ConnectionState {
  const [state, setState] = React.useState<ConnectionState>(
    client?.getState() ?? 'connecting',
  );
  React.useEffect(() => {
    if (!client) return;
    return client.onStateChange(setState);
  }, [client]);
  return state;
}

type ServerEventName = keyof ServerToClientEvents;
type PayloadOf<K extends ServerEventName> = Parameters<ServerToClientEvents[K]>[0];

/** Subscribe to a typed server event for the lifetime of the component. */
export function useSocketEvent<K extends ServerEventName>(
  client: SocketClient | null,
  event: K,
  handler: (payload: PayloadOf<K>) => void,
): void {
  const ref = React.useRef(handler);
  ref.current = handler;
  React.useEffect(() => {
    if (!client) return;
    return client.on(event, (p) => ref.current(p as PayloadOf<K>));
  }, [client, event]);
}
