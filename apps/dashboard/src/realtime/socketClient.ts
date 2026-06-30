import {
  SocketEvent,
  SubscriptionKind,
  type AssignmentEvent,
  type ClientToServerEvents,
  type PositionEvent,
  type RouteUpdateEvent,
  type ServerToClientEvents,
  type SubscribePayload,
  type ZoneEventMessage,
} from '@fleet/contracts';


export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline';

/** Minimal transport surface the client needs (browser WebSocket-compatible). */
export interface SocketTransport {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

/** Factory that opens a transport for a URL (defaults to native WebSocket). */
export type TransportFactory = (url: string) => SocketTransport;

export interface SocketClientOptions {
  url: string;
  
  token?: string;
  /** Injectable transport factory (defaults to native WebSocket). */
  transportFactory?: TransportFactory;
  /** Backoff schedule in ms; the last value repeats. Defaults provided. */
  backoffScheduleMs?: number[];
  /** Injectable timer (defaults to window.setTimeout) for testability. */
  setTimeoutFn?: (fn: () => void, ms: number) => number;
  clearTimeoutFn?: (handle: number) => void;
  /** Auto-connect on construction. Defaults to true. */
  autoConnect?: boolean;
}

type ServerEventName = keyof ServerToClientEvents;

interface ServerEventPayloads {
  [SocketEvent.Position]: PositionEvent;
  [SocketEvent.ZoneEvent]: ZoneEventMessage;
  [SocketEvent.Assignment]: AssignmentEvent;
  [SocketEvent.RouteUpdate]: RouteUpdateEvent;
}

const DEFAULT_BACKOFF = [500, 1000, 2000, 5000, 10000];

function defaultTransportFactory(url: string): SocketTransport {
  // eslint-disable-next-line no-undef
  return new WebSocket(url) as unknown as SocketTransport;
}

/** Stable room key for a subscription, mirroring the server's room naming. */
function subKey(p: SubscribePayload): string {
  return `${p.kind}:${p.id}`;
}

/**
 * A reconnecting, typed Streaming_Service client. Construct it, listen for
 * connection-state changes and server events, then `subscribe` to vehicles or
 * deliveries; subscriptions survive reconnects automatically.
 */
export class SocketClient {
  private readonly opts: Required<
    Omit<SocketClientOptions, 'token' | 'transportFactory' | 'setTimeoutFn' | 'clearTimeoutFn'>
  > & SocketClientOptions;

  private transport: SocketTransport | null = null;
  private state: ConnectionState = 'connecting';
  private attempt = 0;
  private reconnectHandle: number | null = null;
  private closedByUser = false;

  
  private readonly subscriptions = new Map<string, SubscribePayload>();

  private readonly stateListeners = new Set<(s: ConnectionState) => void>();
  private readonly eventListeners: {
    [K in ServerEventName]: Set<(payload: ServerEventPayloads[K]) => void>;
  } = {
    [SocketEvent.Position]: new Set(),
    [SocketEvent.ZoneEvent]: new Set(),
    [SocketEvent.Assignment]: new Set(),
    [SocketEvent.RouteUpdate]: new Set(),
  };

  constructor(options: SocketClientOptions) {
    this.opts = {
      backoffScheduleMs: DEFAULT_BACKOFF,
      autoConnect: true,
      ...options,
    };
    if (this.opts.autoConnect) this.connect();
  }

  /** The current connection state. */
  getState(): ConnectionState {
    return this.state;
  }

  
  onStateChange(fn: (s: ConnectionState) => void): () => void {
    this.stateListeners.add(fn);
    fn(this.state);
    return () => this.stateListeners.delete(fn);
  }

  /** Listen for a typed server→client event. Returns an unsubscriber. */
  on<K extends ServerEventName>(
    event: K,
    fn: (payload: ServerEventPayloads[K]) => void,
  ): () => void {
    this.eventListeners[event].add(fn as never);
    return () => this.eventListeners[event].delete(fn as never);
  }

  /** Open the connection (idempotent while already open/connecting). */
  connect(): void {
    this.closedByUser = false;
    if (this.transport) return;
    this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting');

    const factory = this.opts.transportFactory ?? defaultTransportFactory;
    const url = this.opts.token
      ? `${this.opts.url}${this.opts.url.includes('?') ? '&' : '?'}token=${encodeURIComponent(this.opts.token)}`
      : this.opts.url;
    const t = factory(url);
    this.transport = t;

    t.onopen = () => {
      this.attempt = 0;
      this.setState('connected');
      for (const sub of this.subscriptions.values()) {
        this.emit(SocketEvent.Subscribe, sub);
      }
    };
    t.onmessage = (ev) => this.handleMessage(ev.data);
    t.onerror = () => {
      /* errors are followed by close; reconnection is handled there */
    };
    t.onclose = () => this.handleClose();
  }

  /** Close the connection and stop reconnecting. */
  disconnect(): void {
    this.closedByUser = true;
    this.cancelReconnect();
    this.teardownTransport();
    this.setState('offline');
  }

  
  subscribe(kind: SubscriptionKind, id: string): void {
    const payload: SubscribePayload = { kind, id };
    this.subscriptions.set(subKey(payload), payload);
    if (this.state === 'connected') this.emit(SocketEvent.Subscribe, payload);
  }

  /** Stop receiving updates for a vehicle or delivery. */
  unsubscribe(kind: SubscriptionKind, id: string): void {
    const payload: SubscribePayload = { kind, id };
    this.subscriptions.delete(subKey(payload));
    if (this.state === 'connected') this.emit(SocketEvent.Unsubscribe, payload);
  }

  /** The set of currently active subscription keys (for inspection/tests). */
  activeSubscriptions(): string[] {
    return [...this.subscriptions.keys()];
  }

  // --- internals ---------------------------------------------------------

  private emit<K extends keyof ClientToServerEvents>(
    event: K,
    payload: SubscribePayload,
  ): void {
    this.transport?.send(JSON.stringify({ event, payload }));
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let parsed: { event?: string; payload?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // ignore malformed frames
    }
    const { event, payload } = parsed;
    if (!event || payload == null) return;
    if (
      event === SocketEvent.Position ||
      event === SocketEvent.ZoneEvent ||
      event === SocketEvent.Assignment ||
      event === SocketEvent.RouteUpdate
    ) {
      for (const fn of this.eventListeners[event]) {
        (fn as (p: unknown) => void)(payload);
      }
    }
  }

  private handleClose(): void {
    this.teardownTransport();
    if (this.closedByUser) {
      this.setState('offline');
      return;
    }
    this.setState('reconnecting');
    const schedule = this.opts.backoffScheduleMs;
    const delay = schedule[Math.min(this.attempt, schedule.length - 1)];
    this.attempt += 1;
    const setT = this.opts.setTimeoutFn ?? ((fn, ms) => window.setTimeout(fn, ms));
    this.reconnectHandle = setT(() => {
      this.reconnectHandle = null;
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectHandle != null) {
      const clearT = this.opts.clearTimeoutFn ?? ((h) => window.clearTimeout(h));
      clearT(this.reconnectHandle);
      this.reconnectHandle = null;
    }
  }

  private teardownTransport(): void {
    if (this.transport) {
      this.transport.onopen = null;
      this.transport.onclose = null;
      this.transport.onerror = null;
      this.transport.onmessage = null;
      try {
        this.transport.close();
      } catch {
        /* ignore */
      }
      this.transport = null;
    }
  }

  private setState(s: ConnectionState): void {
    if (this.state === s) return;
    this.state = s;
    for (const fn of this.stateListeners) fn(s);
  }
}
