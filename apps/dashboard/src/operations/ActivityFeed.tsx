import React from 'react';
import { ZoneEventType } from '@fleet/contracts';
import { Panel } from '../components/Card';
import { ActivityFeedItem, type ActivityTone } from '../components/ActivityFeedItem';
import { SocketClient } from '../realtime/socketClient';
import { useActivityFeed } from './useActivityFeed';

export interface ActivityFeedProps {
  client: SocketClient | null;
  /** Max entries to retain. */
  limit?: number;
  /** Fixed height for the scroll region. */
  height?: number | string;
}

function toneFor(type: ZoneEventType): ActivityTone {
  return type === ZoneEventType.Enter ? 'enter' : 'exit';
}

/** A scrollable, live-updating activity feed of zone events. */
export function ActivityFeed({
  client,
  limit = 50,
  height = '100%',
}: ActivityFeedProps): React.ReactElement {
  const entries = useActivityFeed(client, limit);
  const now = Date.now();

  return (
    <Panel title="Activity · Live zone events" flush style={{ height }}>
      {entries.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-5)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Waiting for zone activity…
        </div>
      ) : (
        entries.map((e) => (
          <ActivityFeedItem
            key={e.key}
            tone={toneFor(e.type)}
            title={
              <>
                <strong>{e.vehicleId}</strong> {e.type === ZoneEventType.Enter ? 'entered' : 'exited'}{' '}
                {e.label ?? e.zoneId}
              </>
            }
            detail={e.label ? e.zoneId : undefined}
            timestamp={e.timestamp}
            fresh={now - e.receivedAt < 1500}
          />
        ))
      )}
    </Panel>
  );
}
