import { type RouteStop } from '@fleet/contracts';


export interface Route {
  id: string;
  
  assignmentId: string;
  
  stops: RouteStop[];
  
  optimized: boolean;
  /** Index of the next stop to visit. */
  currentStop: number;
  createdAt: string;
  updatedAt: string;
}

export interface RouteRepository {
  findByAssignmentId(assignmentId: string): Promise<Route | null>;
  /** Insert or replace the route for an assignment. */
  upsert(route: Route): Promise<Route>;
}

/** In-memory {@link RouteRepository} for tests and local bootstrapping. */
export class InMemoryRouteRepository implements RouteRepository {
  private readonly byAssignment = new Map<string, Route>();

  findByAssignmentId(assignmentId: string): Promise<Route | null> {
    const found = this.byAssignment.get(assignmentId);
    return Promise.resolve(found ? clone(found) : null);
  }

  upsert(route: Route): Promise<Route> {
    this.byAssignment.set(route.assignmentId, clone(route));
    return Promise.resolve(clone(route));
  }
}

function clone(route: Route): Route {
  return { ...route, stops: route.stops.map((s) => ({ ...s, deliveryIds: [...s.deliveryIds] })) };
}
