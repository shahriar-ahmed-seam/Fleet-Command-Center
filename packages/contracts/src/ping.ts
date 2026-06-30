export interface Telemetry {
  /** Ground speed in km/h. */
  speed?: number;
  /** Heading in degrees clockwise from true north (0–360). */
  heading?: number;
  /** Device battery level as a percentage (0–100). */
  battery?: number;
}


export interface PingPayload {
  vehicleId: string;
  lat: number;
  lng: number;
  /** ISO-8601 event timestamp. */
  timestamp: string;
  telemetry?: Telemetry;
}


export interface PingAccepted {
  accepted: true;
  pingId: string;
}


export interface PingStale {
  accepted: false;
  error: 'stale-ping';
}
