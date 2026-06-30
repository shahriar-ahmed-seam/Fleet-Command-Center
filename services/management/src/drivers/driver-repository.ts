import { DriverStatus } from '@fleet/contracts';


export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  status: DriverStatus;
  
  active: boolean;
  /** ISO-8601 creation time. */
  createdAt: string;
  
  updatedAt: string;
}

/** Fields a caller may change on update (identity/email are immutable here). */
export interface DriverUpdate {
  name?: string;
  phone?: string;
  licenseNumber?: string;
  status?: DriverStatus;
}

export interface DriverRepository {
  insert(driver: Driver): Promise<Driver>;
  findById(id: string): Promise<Driver | null>;
  findByEmail(email: string): Promise<Driver | null>;
  /** Persist a full record (replace by id). */
  save(driver: Driver): Promise<Driver>;
  
  list(status?: DriverStatus): Promise<Driver[]>;
}

/** In-memory {@link DriverRepository} for tests and local bootstrapping. */
export class InMemoryDriverRepository implements DriverRepository {
  private readonly byId = new Map<string, Driver>();
  private readonly emailIndex = new Map<string, string>();

  insert(driver: Driver): Promise<Driver> {
    this.byId.set(driver.id, { ...driver });
    this.emailIndex.set(driver.email.toLowerCase(), driver.id);
    return Promise.resolve({ ...driver });
  }

  findById(id: string): Promise<Driver | null> {
    const found = this.byId.get(id);
    return Promise.resolve(found ? { ...found } : null);
  }

  findByEmail(email: string): Promise<Driver | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    const found = id ? this.byId.get(id) : undefined;
    return Promise.resolve(found ? { ...found } : null);
  }

  save(driver: Driver): Promise<Driver> {
    this.byId.set(driver.id, { ...driver });
    this.emailIndex.set(driver.email.toLowerCase(), driver.id);
    return Promise.resolve({ ...driver });
  }

  list(status?: DriverStatus): Promise<Driver[]> {
    const all = [...this.byId.values()].map((d) => ({ ...d }));
    const filtered =
      status === undefined ? all : all.filter((d) => d.status === status);
    return Promise.resolve(filtered);
  }
}
