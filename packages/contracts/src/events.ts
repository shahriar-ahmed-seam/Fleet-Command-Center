import type { Telemetry } from './ping.js';
import type { ZoneEventType } from './enums.js';

/**
 * Named socket event channels (Socket.IO event names) shared by server and
 * clients. Centralizing the names avoids drift across services and apps.
 */
export enum SocketEvent {
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  Position = 'position',
  ZoneEvent = 'zoneEvent',
  Assignment = 'assignment',
  RouteUpdate = 'routeUpdate',
}


export enum SubscriptionKind {
  Vehicle = 'vehicle',
  Delivery = 'delivery',
}


export interface SubscribePayload {
  kind: SubscriptionKind;
  id: string;
}

/**
 * client → server: stop receiving updates for a resource.
 */
export type UnsubscribePayload = SubscribePayload;


export interface PositionEvent {
  vehicleId: string;
  lat: number;
  lng: number;
  /** ISO-8601 event timestamp. */
  timestamp: string;
  telemetry?: Telemetry;
}


export interface ZoneEventMessage {
  vehicleId: string;
  zoneId: string;
  type: ZoneEventType;
  
  label?: string;
  /** ISO-8601 occurrence timestamp. */
  timestamp: string;
}


export interface RouteStop {
  stopIndex: number;
  deliveryIds: string[];
  lat: number;
  lng: number;
}


export interface AssignmentEvent {
  assignmentId: string;
  driverId: string;
  vehicleId: string;
  deliveryIds: string[];
}


export interface RouteUpdateEvent {
  assignmentId: string;
  stops: RouteStop[];
  optimized: boolean;
}

/**
 * Strongly-typed map from server→client event name to its payload type, usable
 * to type a Socket.IO client/server.
 */
export interface ServerToClientEvents {
  [SocketEvent.Position]: (payload: PositionEvent) => void;
  [SocketEvent.ZoneEvent]: (payload: ZoneEventMessage) => void;
  [SocketEvent.Assignment]: (payload: AssignmentEvent) => void;
  [SocketEvent.RouteUpdate]: (payload: RouteUpdateEvent) => void;
}

/**
 * Strongly-typed map from client→server event name to its payload type.
 */
export interface ClientToServerEvents {
  [SocketEvent.Subscribe]: (payload: SubscribePayload) => void;
  [SocketEvent.Unsubscribe]: (payload: UnsubscribePayload) => void;
}
