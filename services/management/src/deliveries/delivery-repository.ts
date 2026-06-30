import { DeliveryStatus } from '@fleet/contracts';

import { type GeoPoint } from './geocoder';


export interface Delivery {
  id: string;
  address: string;
  recipientName: string;
  recipientContact: string;
  weightKg: number;
  
  destination: GeoPoint;
  status: DeliveryStatus;
  trackingToken: string;
  assignmentId?: string;
  
  destinationZoneId?: string;
  failureReason?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRepository {
  insert(delivery: Delivery): Promise<Delivery>;
  findById(id: string): Promise<Delivery | null>;
  /** Persist a full record (replace by id) — used by lifecycle transitions. */
  save(delivery: Delivery): Promise<Delivery>;
  
  listByAssignmentId(assignmentId: string): Promise<Delivery[]>;
  
  listByDestinationZoneId(zoneId: string): Promise<Delivery[]>;
  list(): Promise<Delivery[]>;
}

/** In-memory {@link DeliveryRepository} for tests and local bootstrapping. */
export class InMemoryDeliveryRepository implements DeliveryRepository {
  private readonly byId = new Map<string, Delivery>();

  insert(delivery: Delivery): Promise<Delivery> {
    this.byId.set(delivery.id, { ...delivery });
    return Promise.resolve({ ...delivery });
  }

  findById(id: string): Promise<Delivery | null> {
    const found = this.byId.get(id);
    return Promise.resolve(found ? { ...found } : null);
  }

  save(delivery: Delivery): Promise<Delivery> {
    this.byId.set(delivery.id, { ...delivery });
    return Promise.resolve({ ...delivery });
  }

  listByAssignmentId(assignmentId: string): Promise<Delivery[]> {
    return Promise.resolve(
      [...this.byId.values()]
        .filter((d) => d.assignmentId === assignmentId)
        .map((d) => ({ ...d })),
    );
  }

  listByDestinationZoneId(zoneId: string): Promise<Delivery[]> {
    return Promise.resolve(
      [...this.byId.values()]
        .filter((d) => d.destinationZoneId === zoneId)
        .map((d) => ({ ...d })),
    );
  }

  list(): Promise<Delivery[]> {
    return Promise.resolve([...this.byId.values()].map((d) => ({ ...d })));
  }
}
