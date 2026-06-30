export interface Vehicle {
  id: string;
  
  identifier: string;
  type: string;
  capacityKg: number;
  
  driverId?: string;
  
  associatedAt?: string;
  createdAt: string;
}

export interface VehicleRepository {
  insert(vehicle: Vehicle): Promise<Vehicle>;
  findById(id: string): Promise<Vehicle | null>;
  findByIdentifier(identifier: string): Promise<Vehicle | null>;
  
  findByDriverId(driverId: string): Promise<Vehicle | null>;
  /** Persist a full record (replace by id). */
  save(vehicle: Vehicle): Promise<Vehicle>;
  
  list(): Promise<Vehicle[]>;
}

/** In-memory {@link VehicleRepository} for tests and local bootstrapping. */
export class InMemoryVehicleRepository implements VehicleRepository {
  private readonly byId = new Map<string, Vehicle>();
  private readonly identifierIndex = new Map<string, string>();

  insert(vehicle: Vehicle): Promise<Vehicle> {
    this.byId.set(vehicle.id, { ...vehicle });
    this.identifierIndex.set(key(vehicle.identifier), vehicle.id);
    return Promise.resolve({ ...vehicle });
  }

  findById(id: string): Promise<Vehicle | null> {
    const found = this.byId.get(id);
    return Promise.resolve(found ? { ...found } : null);
  }

  findByIdentifier(identifier: string): Promise<Vehicle | null> {
    const id = this.identifierIndex.get(key(identifier));
    const found = id ? this.byId.get(id) : undefined;
    return Promise.resolve(found ? { ...found } : null);
  }

  findByDriverId(driverId: string): Promise<Vehicle | null> {
    const found = [...this.byId.values()].find((v) => v.driverId === driverId);
    return Promise.resolve(found ? { ...found } : null);
  }

  save(vehicle: Vehicle): Promise<Vehicle> {
    this.byId.set(vehicle.id, { ...vehicle });
    this.identifierIndex.set(key(vehicle.identifier), vehicle.id);
    return Promise.resolve({ ...vehicle });
  }

  list(): Promise<Vehicle[]> {
    return Promise.resolve([...this.byId.values()].map((v) => ({ ...v })));
  }
}

/** Case-insensitive identifier key so duplicates are detected regardless of case. */
function key(identifier: string): string {
  return identifier.trim().toLowerCase();
}
