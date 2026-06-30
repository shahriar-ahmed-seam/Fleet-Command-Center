package ingest

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	"time"
)

// StoredPing is the persisted form of an accepted Location_Ping (design data
// model: Location_Ping), carrying the resolved vehicle/driver association and
type StoredPing struct {
	ID         string
	VehicleID  string
	DriverID   string
	Lat        float64
	Lng        float64
	Timestamp  time.Time
	ReceivedAt time.Time
	Telemetry  *Telemetry
}

// AcceptedPingEvent is published to the queue for the Geofence_Engine and
// Streaming_Service after a ping is persisted.
type AcceptedPingEvent struct {
	PingID    string
	VehicleID string
	DriverID  string
	Lat       float64
	Lng       float64
	Timestamp time.Time
	Telemetry *Telemetry
}

// Store persists accepted pings (PostGIS-backed in production).
type Store interface {
	Persist(ctx context.Context, p StoredPing) error
}

// HighWaterMark tracks the latest accepted event timestamp per vehicle so
// production so any ingestion replica enforces ordering.
type HighWaterMark interface {
	// Latest returns the latest accepted timestamp for a vehicle; ok is false
	// when the vehicle has no accepted ping yet.
	Latest(vehicleID string) (time.Time, bool)
	// Advance records ts as the vehicle's new high-water mark.
	Advance(vehicleID string, ts time.Time)
}

// Publisher publishes an accepted-ping event to the queue. Its failure must
type Publisher interface {
	Publish(ctx context.Context, e AcceptedPingEvent) error
}

// DriverResolver resolves the active driver associated with a vehicle so the
type DriverResolver interface {
	DriverForVehicle(vehicleID string) (string, bool)
}

// Outcome is the classification of an ingestion attempt.
type Outcome int

const (
	// Accepted: the ping was valid, fresh, persisted, and acknowledged.
	Accepted Outcome = iota
	Invalid
	// Stale: the ping was older than the vehicle high-water mark and discarded;
	Stale
)

// Result is the outcome of Ingest. PingID is set when Accepted; Fields is set
// when Invalid.
type Result struct {
	Status Outcome
	PingID string
	Fields []string
}

// Service orchestrates the per-ping hot path. The clock and id generator are
// injectable so ordering and persistence are deterministically testable.
type Service struct {
	store     Store
	hwm       HighWaterMark
	publisher Publisher
	drivers   DriverResolver
	now       func() time.Time
	newID     func() string
}

// Option configures a Service.
type Option func(*Service)

// WithClock overrides the wall clock (defaults to time.Now).
func WithClock(now func() time.Time) Option {
	return func(s *Service) { s.now = now }
}

// WithIDGenerator overrides the ping id generator (defaults to random hex).
func WithIDGenerator(gen func() string) Option {
	return func(s *Service) { s.newID = gen }
}

// WithDriverResolver attaches a vehicle→driver resolver (defaults to none).
func WithDriverResolver(r DriverResolver) Option {
	return func(s *Service) { s.drivers = r }
}

// NewService builds an ingestion Service. A nil publisher is replaced with a
func NewService(store Store, hwm HighWaterMark, publisher Publisher, opts ...Option) *Service {
	s := &Service{
		store:     store,
		hwm:       hwm,
		publisher: publisher,
		now:       time.Now,
		newID:     randomID,
	}
	if s.publisher == nil {
		s.publisher = noopPublisher{}
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Ingest validates, orders, persists, and publishes a single ping.
//
// Order of operations matters for resilience: the ping is persisted and the
// high-water mark advanced before the (best-effort) queue publish, so a ping is
// acknowledged as Accepted even when the Streaming_Service / queue is
// as an error and nothing is acknowledged.
func (s *Service) Ingest(ctx context.Context, req PingRequest) (Result, error) {
	if fields := Validate(req); len(fields) > 0 {
		return Result{Status: Invalid, Fields: fields}, nil
	}

	ts, _ := parseTimestamp(*req.Timestamp) // validated above
	vehicleID := *req.VehicleID

	if latest, ok := s.hwm.Latest(vehicleID); ok && ts.Before(latest) {
		return Result{Status: Stale}, nil
	}

	driverID := ""
	if s.drivers != nil {
		if id, ok := s.drivers.DriverForVehicle(vehicleID); ok {
			driverID = id
		}
	}

	stored := StoredPing{
		ID:         s.newID(),
		VehicleID:  vehicleID,
		DriverID:   driverID,
		Lat:        *req.Lat,
		Lng:        *req.Lng,
		Timestamp:  ts,
		ReceivedAt: s.now().UTC(),
		Telemetry:  req.Telemetry,
	}

	if err := s.store.Persist(ctx, stored); err != nil {
		// Persistence is authoritative; surface the failure (no ack).
		return Result{}, err
	}

	// Only advance the high-water mark once the ping is durably persisted.
	s.hwm.Advance(vehicleID, ts)

	// Best-effort fan-out: a publish failure (streaming/queue down) must not
	event := AcceptedPingEvent{
		PingID:    stored.ID,
		VehicleID: stored.VehicleID,
		DriverID:  stored.DriverID,
		Lat:       stored.Lat,
		Lng:       stored.Lng,
		Timestamp: stored.Timestamp,
		Telemetry: stored.Telemetry,
	}
	if err := s.publisher.Publish(ctx, event); err != nil {
		log.Printf("ingestion: publish accepted-ping %s failed (persisted, ack issued): %v", stored.ID, err)
	}

	return Result{Status: Accepted, PingID: stored.ID}, nil
}

// randomID returns a 128-bit random hex identifier.
func randomID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		// rand.Read failing is catastrophic; fall back to the clock so the
		// service does not panic on the hot path.
		return hex.EncodeToString([]byte(time.Now().UTC().Format(time.RFC3339Nano)))
	}
	return hex.EncodeToString(b[:])
}

// noopPublisher drops events; used when no queue is configured.
type noopPublisher struct{}

func (noopPublisher) Publish(context.Context, AcceptedPingEvent) error { return nil }
