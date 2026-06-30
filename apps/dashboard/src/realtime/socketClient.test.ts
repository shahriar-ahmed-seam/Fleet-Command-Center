import { test, expect, vi } from 'vitest';
import { SubscriptionKind } from '@fleet/contracts';
import { SocketClient, type SocketTransport } from './socketClient';

/** A controllable fake WebSocket transport. */
function makeFakeTransport() {
  const sent: string[] = [];
  let current: SocketTransport | null = null;
  const factory = (): SocketTransport => {
    const t: SocketTransport = {
      send: (d) => sent.push(d),
      close: () => {},
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };
    current = t;
    return t;
  };
  return {
    factory,
    sent,
    open: () => current?.onopen?.(),
    drop: () => current?.onclose?.(),
  };
}

test('connection-lost triggers auto-reconnect and resumes subscriptions', () => {
  const fake = makeFakeTransport();
  const timers: Array<() => void> = [];

  const client = new SocketClient({
    url: 'ws://test/stream',
    transportFactory: fake.factory,
    setTimeoutFn: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeoutFn: () => {},
  });

  const states: string[] = [];
  client.onStateChange((s) => states.push(s));

  // Open and subscribe.
  fake.open();
  expect(client.getState()).toBe('connected');
  client.subscribe(SubscriptionKind.Vehicle, 'veh-1');
  expect(client.activeSubscriptions()).toContain('vehicle:veh-1');

  // Drop the connection → goes to reconnecting and schedules a retry.
  fake.drop();
  expect(client.getState()).toBe('reconnecting');
  expect(timers).toHaveLength(1);

  // Fire the scheduled reconnect, then the new transport opens.
  timers[0]();
  fake.open();
  expect(client.getState()).toBe('connected');

  // The prior subscription was re-applied on reconnect (a subscribe frame sent).
  const subscribeFrames = fake.sent.filter((f) => f.includes('"vehicle:veh-1"') || f.includes('"veh-1"'));
  expect(subscribeFrames.length).toBeGreaterThanOrEqual(2);

  expect(states).toContain('reconnecting');
  expect(states).toContain('connected');
});

test('user-initiated disconnect goes offline and stops reconnecting', () => {
  const fake = makeFakeTransport();
  const client = new SocketClient({
    url: 'ws://test/stream',
    transportFactory: fake.factory,
    setTimeoutFn: (fn) => {
      void fn;
      return 1;
    },
    clearTimeoutFn: () => {},
  });
  fake.open();
  client.disconnect();
  expect(client.getState()).toBe('offline');
  // A subsequent close from the (now torn-down) socket must not reconnect.
  fake.drop();
  expect(client.getState()).toBe('offline');
});

// Silence unused import warning if vi is not otherwise used.
void vi;
