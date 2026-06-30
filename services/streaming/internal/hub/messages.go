// Package hub implements the Streaming_Service core: room-keyed subscriptions
// (vehicle:{id}, delivery:{id}, dashboard:global), broadcast of position and
// zone events, disconnect resource release, reconnect subscription resume, a
// connection-status signal, and cross-replica fan-out over Redis Pub/Sub
//
// The hub is transport-agnostic: connections deliver messages through a Sink,
// so the same logic backs the WebSocket transport in production and a
// collecting sink in tests.
package hub

import "encoding/json"

// SocketEvent names mirror packages/contracts SocketEvent so the Go service and
// the TypeScript clients agree on the wire vocabulary.
const (
	EventSubscribe   = "subscribe"
	EventUnsubscribe = "unsubscribe"
	EventPosition    = "position"
	EventZoneEvent   = "zoneEvent"
	EventAssignment  = "assignment"
	EventRouteUpdate = "routeUpdate"
)

// SubscriptionKind enumerates the subscribable resource kinds that map to rooms
type SubscriptionKind string

const (
	KindVehicle  SubscriptionKind = "vehicle"
	KindDelivery SubscriptionKind = "delivery"
)

type Telemetry struct {
	Speed   *float64 `json:"speed,omitempty"`
	Heading *float64 `json:"heading,omitempty"`
	Battery *float64 `json:"battery,omitempty"`
}

// PositionEvent is a vehicle position update broadcast within 2 s of
type PositionEvent struct {
	VehicleID string     `json:"vehicleId"`
	Lat       float64    `json:"lat"`
	Lng       float64    `json:"lng"`
	Timestamp string     `json:"timestamp"`
	Telemetry *Telemetry `json:"telemetry,omitempty"`
}

type ZoneEventMessage struct {
	VehicleID string  `json:"vehicleId"`
	ZoneID    string  `json:"zoneId"`
	Type      string  `json:"type"`
	Label     *string `json:"label,omitempty"`
	Timestamp string  `json:"timestamp"`
}

// RouteStop is one ordered stop in a route; DeliveryIDs groups co-located
type RouteStop struct {
	StopIndex   int      `json:"stopIndex"`
	DeliveryIDs []string `json:"deliveryIds"`
	Lat         float64  `json:"lat"`
	Lng         float64  `json:"lng"`
}

type AssignmentEvent struct {
	AssignmentID string   `json:"assignmentId"`
	DriverID     string   `json:"driverId"`
	VehicleID    string   `json:"vehicleId"`
	DeliveryIDs  []string `json:"deliveryIds"`
}

type RouteUpdateEvent struct {
	AssignmentID string      `json:"assignmentId"`
	Stops        []RouteStop `json:"stops"`
	Optimized    bool        `json:"optimized"`
}

// Message is the serializable envelope carried over the Sink and through
// Pub/Sub: an event name plus its JSON-encoded payload. Keeping the payload as
// raw JSON lets the hub fan messages out across replicas without knowing every
// payload type.
type Message struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// newMessage marshals a typed payload into a Message for the given event.
func newMessage(event string, payload any) (Message, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return Message{}, err
	}
	return Message{Event: event, Data: data}, nil
}

// PositionMessage builds a position update message.
func PositionMessage(p PositionEvent) (Message, error) {
	return newMessage(EventPosition, p)
}

// ZoneEvent builds a zone-event message.
func ZoneEvent(z ZoneEventMessage) (Message, error) {
	return newMessage(EventZoneEvent, z)
}

// AssignmentMessage builds an assignment notification message.
func AssignmentMessage(a AssignmentEvent) (Message, error) {
	return newMessage(EventAssignment, a)
}

// RouteUpdateMessage builds a route-update message.
func RouteUpdateMessage(r RouteUpdateEvent) (Message, error) {
	return newMessage(EventRouteUpdate, r)
}
