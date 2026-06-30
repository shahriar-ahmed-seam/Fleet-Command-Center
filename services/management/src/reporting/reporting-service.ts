import { DeliveryStatus, TERMINAL_DELIVERY_STATUSES } from '@fleet/contracts';

import { DomainError } from '../common/errors';
import {
  type DeliveryStatusHistoryEntry,
  type DeliveryStatusHistoryRepository,
} from './delivery-status-history-repository';
import {
  type LocationPing,
  type LocationPingRepository,
} from './location-ping-repository';

/** A closed time range `[from, to]` (inclusive), as ISO-8601 timestamps. */
export interface TimeRange {
  from: string;
  to: string;
}


export interface DeliverySummary {
  completed: number;
  failed: number;
  cancelled: number;
}

export class ReportingService {
  constructor(
    private readonly history: DeliveryStatusHistoryRepository,
    private readonly pings: LocationPingRepository,
  ) {}

  
  async getDeliveryHistory(
    deliveryId: string,
  ): Promise<DeliveryStatusHistoryEntry[]> {
    const entries = await this.history.listByDeliveryId(deliveryId);
    return stableSortByTime(entries, (e) => e.occurredAt);
  }

  
  async getVehicleTrack(
    vehicleId: string,
    range: TimeRange,
  ): Promise<LocationPing[]> {
    const { fromMs, toMs } = parseRange(range);
    const inRange = (await this.pings.listByVehicleId(vehicleId)).filter((p) => {
      const t = Date.parse(p.timestamp);
      return t >= fromMs && t <= toMs;
    });
    return stableSortByTime(inRange, (p) => p.timestamp);
  }

  
  async getDeliverySummary(range: TimeRange): Promise<DeliverySummary> {
    const { fromMs, toMs } = parseRange(range);
    const summary: DeliverySummary = { completed: 0, failed: 0, cancelled: 0 };

    for (const entry of await this.history.list()) {
      if (!TERMINAL_DELIVERY_STATUSES.includes(entry.toStatus)) {
        continue;
      }
      const t = Date.parse(entry.occurredAt);
      if (t < fromMs || t > toMs) {
        continue;
      }
      switch (entry.toStatus) {
        case DeliveryStatus.Completed:
          summary.completed += 1;
          break;
        case DeliveryStatus.Failed:
          summary.failed += 1;
          break;
        case DeliveryStatus.Cancelled:
          summary.cancelled += 1;
          break;
        default:
          break;
      }
    }

    return summary;
  }
}

/** Parse a range to epoch ms, rejecting an inverted or unparseable range. */
function parseRange(range: TimeRange): { fromMs: number; toMs: number } {
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw DomainError.of('validation-error', ['from', 'to'], 400);
  }
  if (fromMs > toMs) {
    throw DomainError.of('validation-error', ['from', 'to'], 400);
  }
  return { fromMs, toMs };
}

/**
 * Sort a copy of `items` ascending by a timestamp accessor. The sort is stable,
 * so items sharing a timestamp keep their original relative order.
 */
function stableSortByTime<T>(items: T[], time: (item: T) => string): T[] {
  return items
    .map((item, index) => ({ item, index, t: Date.parse(time(item)) }))
    .sort((a, b) => (a.t === b.t ? a.index - b.index : a.t - b.t))
    .map((wrapped) => wrapped.item);
}
