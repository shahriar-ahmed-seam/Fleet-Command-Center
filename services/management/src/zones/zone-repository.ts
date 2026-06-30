import { type Ring } from './geometry';


export interface Zone {
  id: string;
  name: string;
  /** Closed exterior ring of `[lng, lat]` positions. */
  polygon: Ring;
  
  arrivalLabel?: string;
  createdAt: string;
}

export interface ZoneRepository {
  insert(zone: Zone): Promise<Zone>;
  findById(id: string): Promise<Zone | null>;
  list(): Promise<Zone[]>;
}

/** In-memory {@link ZoneRepository} for tests and local bootstrapping. */
export class InMemoryZoneRepository implements ZoneRepository {
  private readonly byId = new Map<string, Zone>();

  insert(zone: Zone): Promise<Zone> {
    this.byId.set(zone.id, clone(zone));
    return Promise.resolve(clone(zone));
  }

  findById(id: string): Promise<Zone | null> {
    const found = this.byId.get(id);
    return Promise.resolve(found ? clone(found) : null);
  }

  list(): Promise<Zone[]> {
    return Promise.resolve([...this.byId.values()].map(clone));
  }
}

function clone(zone: Zone): Zone {
  return {
    ...zone,
    polygon: zone.polygon.map((p) => [p[0], p[1]] as [number, number]),
  };
}
