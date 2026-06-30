import { type GeoPoint } from '../deliveries';

/** A single stop the optimizer must sequence. */
export interface OptimizeStop {
  deliveryId: string;
  lat: number;
  lng: number;
}

/** Request body for `POST /optimize` (origin = vehicle's current location). */
export interface OptimizeRequest {
  origin: GeoPoint;
  stops: OptimizeStop[];
}


export interface OptimizeResponse {
  sequence: string[];
  groups: string[][];
}

export interface OptimizerClient {
  
  optimize(request: OptimizeRequest): Promise<OptimizeResponse>;
}
