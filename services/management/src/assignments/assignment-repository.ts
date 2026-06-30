import { AssignmentStatus } from '@fleet/contracts';


export interface Assignment {
  id: string;
  driverId: string;
  vehicleId: string;
  status: AssignmentStatus;
  
  acceptedAt?: string;
  createdAt: string;
}

export interface AssignmentRepository {
  insert(assignment: Assignment): Promise<Assignment>;
  findById(id: string): Promise<Assignment | null>;
  /** Persist a full record (replace by id). */
  save(assignment: Assignment): Promise<Assignment>;
  list(): Promise<Assignment[]>;
}

/** In-memory {@link AssignmentRepository} for tests and local bootstrapping. */
export class InMemoryAssignmentRepository implements AssignmentRepository {
  private readonly byId = new Map<string, Assignment>();

  insert(assignment: Assignment): Promise<Assignment> {
    this.byId.set(assignment.id, { ...assignment });
    return Promise.resolve({ ...assignment });
  }

  findById(id: string): Promise<Assignment | null> {
    const found = this.byId.get(id);
    return Promise.resolve(found ? { ...found } : null);
  }

  save(assignment: Assignment): Promise<Assignment> {
    this.byId.set(assignment.id, { ...assignment });
    return Promise.resolve({ ...assignment });
  }

  list(): Promise<Assignment[]> {
    return Promise.resolve([...this.byId.values()].map((a) => ({ ...a })));
  }
}


export function isActiveAssignment(assignment: Assignment): boolean {
  return assignment.status !== AssignmentStatus.Complete;
}
