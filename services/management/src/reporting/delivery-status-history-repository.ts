import { DeliveryStatus } from '@fleet/contracts';


export interface DeliveryStatusHistoryEntry {
  id: string;
  deliveryId: string;
  /** Null for the initial Created transition. */
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus;
  reason?: string;
  /** ISO-8601 transition timestamp. */
  occurredAt: string;
}

export interface DeliveryStatusHistoryRepository {
  insert(entry: DeliveryStatusHistoryEntry): Promise<DeliveryStatusHistoryEntry>;
  /** Every transition for a delivery (unordered; the service orders them). */
  listByDeliveryId(deliveryId: string): Promise<DeliveryStatusHistoryEntry[]>;
  /** Every transition recorded across all deliveries (unordered). */
  list(): Promise<DeliveryStatusHistoryEntry[]>;
}

/** In-memory {@link DeliveryStatusHistoryRepository} for tests/local use. */
export class InMemoryDeliveryStatusHistoryRepository
  implements DeliveryStatusHistoryRepository
{
  private readonly entries: DeliveryStatusHistoryEntry[] = [];

  insert(entry: DeliveryStatusHistoryEntry): Promise<DeliveryStatusHistoryEntry> {
    this.entries.push({ ...entry });
    return Promise.resolve({ ...entry });
  }

  listByDeliveryId(deliveryId: string): Promise<DeliveryStatusHistoryEntry[]> {
    return Promise.resolve(
      this.entries
        .filter((e) => e.deliveryId === deliveryId)
        .map((e) => ({ ...e })),
    );
  }

  list(): Promise<DeliveryStatusHistoryEntry[]> {
    return Promise.resolve(this.entries.map((e) => ({ ...e })));
  }
}
