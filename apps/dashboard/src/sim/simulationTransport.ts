import type { SocketTransport, TransportFactory } from '../realtime/socketClient';
import { FleetSimulation } from './fleetSimulation';

const TICK_MS = 1000;

/**
 * A SocketTransport backed by the in-browser FleetSimulation. The real
 * SocketClient drives it unchanged: it "connects" on the next tick, then
 * receives position and zone-event frames on an interval — so simulation mode
 * exercises the exact same client, hooks, and UI as a live backend.
 */
function createSimulationTransport(): SocketTransport {
  const sim = new FleetSimulation();
  let timer: ReturnType<typeof setInterval> | null = null;
  let open = false;

  const transport: SocketTransport = {
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    send() {
      // Subscriptions are accepted but ignored: the simulation broadcasts the
      // whole fleet, matching the dashboard's global subscription.
    },
    close() {
      open = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };

  // Connect asynchronously, mirroring a real socket's open handshake.
  setTimeout(() => {
    open = true;
    transport.onopen?.();
    // Emit one immediate batch so the map is populated without waiting a tick.
    emit(sim.tick(TICK_MS));
    timer = setInterval(() => emit(sim.tick(TICK_MS)), TICK_MS);
  }, 0);

  function emit(frames: ReturnType<FleetSimulation['tick']>): void {
    if (!open || !transport.onmessage) return;
    for (const frame of frames) {
      transport.onmessage({ data: JSON.stringify(frame) });
    }
  }

  return transport;
}

/** A TransportFactory that yields simulation-backed transports. */
export const simulationTransportFactory: TransportFactory = () =>
  createSimulationTransport();
