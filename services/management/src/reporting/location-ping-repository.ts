export interface LocationPing {
  id: string;
  vehicleId: string;
  driverId?: string;
  lat: number;
  lng: number;
  /** ISO-8601 event timestamp. */
  timestamp: string;
  receivedAt?: string;
  speed?: number;
  heading?: number;
  battery?: number;
}

export interface LocationPingRepository {
  insert(ping: LocationPing): Promise<LocationPing>;
  /** Every ping for a vehicle (unordered; the service ranges/orders them). */
  listByVehicleId(vehicleId: string): Promise<LocationPing[]>;
}

/** In-memory {@link LocationPingRepository} for tests/local use. */
export class InMemoryLocationPingRepository implements LocationPingRepository {
  private readonly pings: LocationPing[] = [];

  insert(ping: LocationPing): Promise<LocationPing> {
    this.pings.push({ ...ping });
    return Promise.resolve({ ...ping });
  }

  listByVehicleId(vehicleId: string): Promise<LocationPing[]> {
    return Promise.resolve(
      this.pings.filter((p) => p.vehicleId === vehicleId).map((p) => ({ ...p })),
    );
  }
}
