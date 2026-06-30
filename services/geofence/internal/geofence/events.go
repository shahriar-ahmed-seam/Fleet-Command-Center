package geofence

import (
	"context"
	"sync"
	"time"
)

// streaming hub ZoneEventMessage "type" field).
type EventType string

const (
	// EventEnter marks a vehicle moving from outside to inside-or-on-boundary
	EventEnter EventType = "Enter"
	// EventExit marks a vehicle moving from inside to strictly outside a zone
	EventExit EventType = "Exit"
)

// AcceptedPing is the queue event the Geofence_Engine consumes: an accepted
// ingestion AcceptedPingEvent so the two services agree on the wire.
type AcceptedPing struct {
	PingID    string    `json:"pingId"`
	VehicleID string    `json:"vehicleId"`
	DriverID  string    `json:"driverId"`
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	Timestamp time.Time `json:"timestamp"`
}

// Point returns the ping's coordinate.
func (p AcceptedPing) Point() Point { return Point{Lat: p.Lat, Lng: p.Lng} }

// ZoneEvent is a generated geo-fence event published to the queue for the
// Streaming_Service. The JSON tags match the streaming hub ZoneEventMessage
// (and @fleet/contracts) so the event fans out to clients unchanged: Label is
type ZoneEvent struct {
	VehicleID string    `json:"vehicleId"`
	ZoneID    string    `json:"zoneId"`
	Type      EventType `json:"type"`
	Label     *string   `json:"label,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// EventPublisher publishes generated Zone_Events to the queue. As on the
// ingestion hot path, a publish failure must not corrupt engine state.
type EventPublisher interface {
	Publish(ctx context.Context, e ZoneEvent) error
}

// CollectingPublisher records published events in memory for local runs and
// tests. Safe for concurrent use.
type CollectingPublisher struct {
	mu     sync.Mutex
	Events []ZoneEvent
}

// Publish appends the event to the collected slice.
func (c *CollectingPublisher) Publish(_ context.Context, e ZoneEvent) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Events = append(c.Events, e)
	return nil
}

// Snapshot returns a copy of the collected events.
func (c *CollectingPublisher) Snapshot() []ZoneEvent {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]ZoneEvent, len(c.Events))
	copy(out, c.Events)
	return out
}

// noopPublisher drops events; used when no queue is configured.
type noopPublisher struct{}

func (noopPublisher) Publish(context.Context, ZoneEvent) error { return nil }
