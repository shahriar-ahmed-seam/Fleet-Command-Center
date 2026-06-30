package geofence_test

import (
	"context"
	"testing"
	"time"

	"github.com/fleet-command-center/services/geofence/internal/geofence"
)

// square is a unit axis-aligned zone polygon covering [0,10] x [0,10] (Lng x Lat).
func square(id string, label *string) geofence.Zone {
	return geofence.Zone{
		ID:           id,
		ArrivalLabel: label,
		Polygon: geofence.Polygon{Vertices: []geofence.Point{
			{Lat: 0, Lng: 0},
			{Lat: 0, Lng: 10},
			{Lat: 10, Lng: 10},
			{Lat: 10, Lng: 0},
		}},
	}
}

func ping(vehicleID string, lat, lng float64) geofence.AcceptedPing {
	return geofence.AcceptedPing{
		VehicleID: vehicleID,
		Lat:       lat,
		Lng:       lng,
		Timestamp: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
}

func TestEnterEmittedOnOutsideToInside(t *testing.T) {
	pub := &geofence.CollectingPublisher{}
	eng := geofence.NewEngine(geofence.NewInMemoryCatalog(square("z1", nil)), geofence.WithPublisher(pub))
	ctx := context.Background()

	// First ping outside -> no event.
	if events, _ := eng.OnAcceptedPing(ctx, ping("v1", 20, 20)); len(events) != 0 {
		t.Fatalf("expected no event outside, got %d", len(events))
	}
	// Second ping inside -> Enter.
	events, err := eng.OnAcceptedPing(ctx, ping("v1", 5, 5))
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0].Type != geofence.EventEnter || events[0].ZoneID != "z1" {
		t.Fatalf("expected one Enter for z1, got %+v", events)
	}
	if len(pub.Snapshot()) != 1 {
		t.Fatalf("expected Enter published, got %d", len(pub.Snapshot()))
	}
}

func TestExitEmittedOnInsideToStrictlyOutside(t *testing.T) {
	eng := geofence.NewEngine(geofence.NewInMemoryCatalog(square("z1", nil)))
	ctx := context.Background()

	_, _ = eng.OnAcceptedPing(ctx, ping("v1", 5, 5))  // Enter
	events, _ := eng.OnAcceptedPing(ctx, ping("v1", 50, 50)) // strictly outside
	if len(events) != 1 || events[0].Type != geofence.EventExit {
		t.Fatalf("expected one Exit, got %+v", events)
	}
}

func TestBoundaryPointCountsAsInside(t *testing.T) {
	eng := geofence.NewEngine(geofence.NewInMemoryCatalog(square("z1", nil)))
	ctx := context.Background()

	// A point exactly on the boundary edge is inside-or-boundary -> Enter.
	events, _ := eng.OnAcceptedPing(ctx, ping("v1", 0, 5)) // on bottom edge
	if len(events) != 1 || events[0].Type != geofence.EventEnter {
		t.Fatalf("expected Enter for boundary point, got %+v", events)
	}
}

func TestNoEventWhenMembershipUnchanged(t *testing.T) {
	eng := geofence.NewEngine(geofence.NewInMemoryCatalog(square("z1", nil)))
	ctx := context.Background()

	_, _ = eng.OnAcceptedPing(ctx, ping("v1", 5, 5)) // Enter
	// Move within the zone -> no event.
	if events, _ := eng.OnAcceptedPing(ctx, ping("v1", 6, 6)); len(events) != 0 {
		t.Fatalf("expected no event while staying inside, got %+v", events)
	}
	// Stay outside repeatedly -> no event.
	_, _ = eng.OnAcceptedPing(ctx, ping("v1", 99, 99)) // Exit
	if events, _ := eng.OnAcceptedPing(ctx, ping("v1", 80, 80)); len(events) != 0 {
		t.Fatalf("expected no event while staying outside, got %+v", events)
	}
}

func TestArrivalLabelIncludedWhenConfigured(t *testing.T) {
	label := "Warehouse A"
	eng := geofence.NewEngine(geofence.NewInMemoryCatalog(square("z1", &label)))
	ctx := context.Background()

	events, _ := eng.OnAcceptedPing(ctx, ping("v1", 5, 5))
	if len(events) != 1 || events[0].Label == nil || *events[0].Label != label {
		t.Fatalf("expected Enter carrying label %q, got %+v", label, events)
	}

	// Exit retains the configured label too.
	exit, _ := eng.OnAcceptedPing(ctx, ping("v1", 50, 50))
	if len(exit) != 1 || exit[0].Label == nil || *exit[0].Label != label {
		t.Fatalf("expected Exit carrying label %q, got %+v", label, exit)
	}
}

func TestNoLabelWhenUnconfigured(t *testing.T) {
	eng := geofence.NewEngine(geofence.NewInMemoryCatalog(square("z1", nil)))
	events, _ := eng.OnAcceptedPing(context.Background(), ping("v1", 5, 5))
	if len(events) != 1 || events[0].Label != nil {
		t.Fatalf("expected Enter with no label, got %+v", events)
	}
}

func TestMembershipIsPerVehicle(t *testing.T) {
	eng := geofence.NewEngine(geofence.NewInMemoryCatalog(square("z1", nil)))
	ctx := context.Background()

	_, _ = eng.OnAcceptedPing(ctx, ping("v1", 5, 5)) // v1 enters
	// v2's first ping inside is its own Enter, independent of v1.
	events, _ := eng.OnAcceptedPing(ctx, ping("v2", 5, 5))
	if len(events) != 1 || events[0].Type != geofence.EventEnter || events[0].VehicleID != "v2" {
		t.Fatalf("expected independent Enter for v2, got %+v", events)
	}
}
