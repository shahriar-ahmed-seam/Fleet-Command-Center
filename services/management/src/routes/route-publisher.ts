import { type RouteUpdateEvent } from '@fleet/contracts';

export interface RoutePublisher {
  
  publishRoute(event: RouteUpdateEvent): Promise<void>;
}

/** A {@link RoutePublisher} that records published events, for tests/local use. */
export class RecordingRoutePublisher implements RoutePublisher {
  readonly published: RouteUpdateEvent[] = [];

  publishRoute(event: RouteUpdateEvent): Promise<void> {
    this.published.push(event);
    return Promise.resolve();
  }
}
