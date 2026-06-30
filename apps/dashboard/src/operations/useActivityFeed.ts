import React from 'react';
import {
  SocketEvent,
  ZoneEventType,
  type ZoneEventMessage,
} from '@fleet/contracts';
import { SocketClient } from '../realtime/socketClient';
import { useSocketEvent } from '../realtime/useConnection';

/** One entry in the activity feed. */
export interface ActivityEntry {
  /** Stable key for rendering. */
  key: string;
  vehicleId: string;
  zoneId: string;
  type: ZoneEventType;
  
  label?: string;
  /** ISO-8601 occurrence timestamp from the event. */
  timestamp: string;
  /** Local receipt time (ms) — marks freshly arrived entries for animation. */
  receivedAt: number;
}

/** Default maximum number of feed entries retained. */
export const DEFAULT_FEED_LIMIT = 50;

let seq = 0;


export function useActivityFeed(
  client: SocketClient | null,
  limit: number = DEFAULT_FEED_LIMIT,
): ActivityEntry[] {
  const [entries, setEntries] = React.useState<ActivityEntry[]>([]);

  useSocketEvent(client, SocketEvent.ZoneEvent, (e: ZoneEventMessage) => {
    seq += 1;
    const entry: ActivityEntry = {
      key: `${e.vehicleId}:${e.zoneId}:${e.timestamp}:${seq}`,
      vehicleId: e.vehicleId,
      zoneId: e.zoneId,
      type: e.type,
      label: e.label,
      timestamp: e.timestamp,
      receivedAt: Date.now(),
    };
    setEntries((prev) => [entry, ...prev].slice(0, limit));
  });

  return entries;
}
