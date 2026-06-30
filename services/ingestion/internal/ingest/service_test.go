package ingest_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/fleet-command-center/services/ingestion/internal/ingest"
)

// ptr is a small helper for building optional request fields.
func ptr[T any](v T) *T { return &v }

func validRequest(vehicleID, ts string) ingest.PingRequest {
	return ingest.PingRequest{
		VehicleID: ptr(vehicleID),
		Lat:       ptr(45.0),
		Lng:       ptr(-120.0),
		Timestamp: ptr(ts),
	}
}

// failingPublisher always errors, simulating the Streaming_Service / queue
type failingPublisher struct{}

func (failingPublisher) Publish(context.Context, ingest.AcceptedPingEvent) error {
	return errors.New("streaming unavailable")
}

// staticDriver resolves every vehicle to a fixed driver id.
type staticDriver struct{ id string }

func (s staticDriver) DriverForVehicle(string) (string, bool) { return s.id, true }

func TestIngestAcceptsValidPingAndPublishes(t *testing.T) {
	store := ingest.NewMemoryStore()
	pub := &ingest.CollectingPublisher{}
	svc := ingest.NewService(store, ingest.NewMemoryHighWaterMark(), pub)

	res, err := svc.Ingest(context.Background(), validRequest("veh-1", "2024-01-01T00:00:00Z"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Status != ingest.Accepted {
		t.Fatalf("expected Accepted, got %v", res.Status)
	}
	if res.PingID == "" {
		t.Fatal("expected a ping id")
	}
	if store.Count() != 1 {
		t.Fatalf("expected 1 persisted ping, got %d", store.Count())
	}
	if pub.Count() != 1 {
		t.Fatalf("expected 1 published event, got %d", pub.Count())
	}
}

func TestIngestRejectsMissingAndOutOfRangeFields(t *testing.T) {
	store := ingest.NewMemoryStore()
	svc := ingest.NewService(store, ingest.NewMemoryHighWaterMark(), &ingest.CollectingPublisher{})

	cases := []struct {
		name string
		req  ingest.PingRequest
		want []string
	}{
		{
			name: "missing lat and timestamp",
			req:  ingest.PingRequest{VehicleID: ptr("v"), Lng: ptr(10.0)},
			want: []string{"lat", "timestamp"},
		},
		{
			name: "out of range coordinates",
			req: ingest.PingRequest{
				VehicleID: ptr("v"), Lat: ptr(90.1), Lng: ptr(-181.0),
				Timestamp: ptr("2024-01-01T00:00:00Z"),
			},
			want: []string{"lat", "lng"},
		},
		{
			name: "unparseable timestamp",
			req: ingest.PingRequest{
				VehicleID: ptr("v"), Lat: ptr(1.0), Lng: ptr(2.0),
				Timestamp: ptr("not-a-time"),
			},
			want: []string{"timestamp"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res, err := svc.Ingest(context.Background(), tc.req)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Status != ingest.Invalid {
				t.Fatalf("expected Invalid, got %v", res.Status)
			}
			if got := res.Fields; !equalStrings(got, tc.want) {
				t.Fatalf("fields = %v, want %v", got, tc.want)
			}
		})
	}
	if store.Count() != 0 {
		t.Fatalf("invalid pings must not persist; got %d", store.Count())
	}
}

func TestIngestDiscardsStalePing(t *testing.T) {
	store := ingest.NewMemoryStore()
	svc := ingest.NewService(store, ingest.NewMemoryHighWaterMark(), &ingest.CollectingPublisher{})

	if _, err := svc.Ingest(context.Background(), validRequest("veh-1", "2024-01-01T00:00:10Z")); err != nil {
		t.Fatalf("seed ping failed: %v", err)
	}
	// An earlier timestamp for the same vehicle is stale and discarded.
	res, err := svc.Ingest(context.Background(), validRequest("veh-1", "2024-01-01T00:00:05Z"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Status != ingest.Stale {
		t.Fatalf("expected Stale, got %v", res.Status)
	}
	if store.Count() != 1 {
		t.Fatalf("stale ping must not persist; expected 1 stored, got %d", store.Count())
	}
}

func TestIngestPersistsAndAcksEvenWhenPublishFails(t *testing.T) {
	store := ingest.NewMemoryStore()
	svc := ingest.NewService(store, ingest.NewMemoryHighWaterMark(), failingPublisher{})

	res, err := svc.Ingest(context.Background(), validRequest("veh-1", "2024-01-01T00:00:00Z"))
	if err != nil {
		t.Fatalf("publish failure must not surface as an error: %v", err)
	}
	if res.Status != ingest.Accepted {
		t.Fatalf("expected Accepted despite publish failure, got %v", res.Status)
	}
	if store.Count() != 1 {
		t.Fatalf("expected the ping to be persisted, got %d", store.Count())
	}
}

func TestIngestRoundTripsTelemetryVehicleAndDriver(t *testing.T) {
	store := ingest.NewMemoryStore()
	svc := ingest.NewService(
		store, ingest.NewMemoryHighWaterMark(), &ingest.CollectingPublisher{},
		ingest.WithDriverResolver(staticDriver{id: "drv-9"}),
	)

	req := ingest.PingRequest{
		VehicleID: ptr("veh-7"),
		Lat:       ptr(12.5),
		Lng:       ptr(-77.25),
		Timestamp: ptr("2024-03-04T05:06:07Z"),
		Telemetry: &ingest.Telemetry{Speed: ptr(42.0), Battery: ptr(88.0)},
	}
	res, err := svc.Ingest(context.Background(), req)
	if err != nil || res.Status != ingest.Accepted {
		t.Fatalf("expected accepted, got status=%v err=%v", res.Status, err)
	}

	stored, ok := store.Get(res.PingID)
	if !ok {
		t.Fatal("persisted ping not found")
	}
	if stored.VehicleID != "veh-7" || stored.DriverID != "drv-9" {
		t.Fatalf("vehicle/driver mismatch: %+v", stored)
	}
	if stored.Lat != 12.5 || stored.Lng != -77.25 {
		t.Fatalf("coordinate mismatch: %+v", stored)
	}
	if !stored.Timestamp.Equal(time.Date(2024, 3, 4, 5, 6, 7, 0, time.UTC)) {
		t.Fatalf("timestamp mismatch: %v", stored.Timestamp)
	}
	if stored.Telemetry == nil || stored.Telemetry.Speed == nil || *stored.Telemetry.Speed != 42.0 {
		t.Fatalf("speed telemetry not round-tripped: %+v", stored.Telemetry)
	}
	if stored.Telemetry.Battery == nil || *stored.Telemetry.Battery != 88.0 {
		t.Fatalf("battery telemetry not round-tripped: %+v", stored.Telemetry)
	}
	if stored.Telemetry.Heading != nil {
		t.Fatalf("omitted heading should remain nil, got %v", *stored.Telemetry.Heading)
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
