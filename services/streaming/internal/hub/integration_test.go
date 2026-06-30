package hub_test

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"

	"github.com/fleet-command-center/services/streaming/internal/hub"
)

// recordingSink collects delivered messages; safe for concurrent use.
type recordingSink struct {
	mu       sync.Mutex
	messages []hub.Message
}

func (s *recordingSink) Deliver(m hub.Message) {
	s.mu.Lock()
	s.messages = append(s.messages, m)
	s.mu.Unlock()
}

func (s *recordingSink) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.messages)
}

// a subscribed dashboard client.
func TestZoneEventBroadcastReachesDashboard(t *testing.T) {
	ctx := context.Background()
	h := hub.New(hub.NewLocalPubSub())
	if err := h.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}

	sink := &recordingSink{}
	h.Connect("dash-1", "dash-session", sink)
	h.SubscribeRoom("dash-1", hub.DashboardRoom)

	label := "Warehouse A"
	msg, err := hub.ZoneEvent(hub.ZoneEventMessage{
		VehicleID: "veh-1", ZoneID: "zone-1", Type: "Enter",
		Label: &label, Timestamp: "2024-01-01T00:00:00Z",
	})
	if err != nil {
		t.Fatalf("build message: %v", err)
	}
	if err := h.Broadcast(ctx, hub.DashboardRoom, msg); err != nil {
		t.Fatalf("broadcast: %v", err)
	}

	if sink.count() != 1 {
		t.Fatalf("expected 1 delivered zone event, got %d", sink.count())
	}
	// The delivered payload carries the zone event with its arrival label.
	var got hub.ZoneEventMessage
	if err := json.Unmarshal(sink.messages[0].Data, &got); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if got.ZoneID != "zone-1" || got.Label == nil || *got.Label != label {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

// room all receive a broadcast to that room.
func TestConcurrentClientsReceiveBroadcast(t *testing.T) {
	ctx := context.Background()
	h := hub.New(hub.NewLocalPubSub())
	if err := h.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}

	const clients = 1000
	sinks := make([]*recordingSink, clients)

	// Connect concurrently to exercise the hub under parallel registration.
	var wg sync.WaitGroup
	for i := 0; i < clients; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			s := &recordingSink{}
			sinks[i] = s
			connID := fmt.Sprintf("conn-%d", i)
			h.Connect(connID, fmt.Sprintf("session-%d", i), s)
			h.SubscribeRoom(connID, hub.DashboardRoom)
		}(i)
	}
	wg.Wait()

	if got := h.RoomSize(hub.DashboardRoom); got != clients {
		t.Fatalf("expected %d clients in room, got %d", clients, got)
	}

	msg, _ := hub.PositionMessage(hub.PositionEvent{VehicleID: "veh-1", Lat: 1, Lng: 2})
	if err := h.Broadcast(ctx, hub.DashboardRoom, msg); err != nil {
		t.Fatalf("broadcast: %v", err)
	}

	// Every connected client received exactly the one broadcast message.
	for i, s := range sinks {
		if s.count() != 1 {
			t.Fatalf("client %d received %d messages, want 1", i, s.count())
		}
	}
}

// vehicle room receives the assignment notification.
func TestAssignmentNotificationReachesDriverApp(t *testing.T) {
	ctx := context.Background()
	h := hub.New(hub.NewLocalPubSub())
	if err := h.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}

	// The driver's app subscribes to its vehicle's room.
	driverSink := &recordingSink{}
	h.Connect("driver-conn", "driver-session", driverSink)
	h.Subscribe("driver-conn", hub.KindVehicle, "veh-1")

	// Another driver subscribed to a different vehicle must not be notified.
	otherSink := &recordingSink{}
	h.Connect("other-conn", "other-session", otherSink)
	h.Subscribe("other-conn", hub.KindVehicle, "veh-2")

	msg, err := hub.AssignmentMessage(hub.AssignmentEvent{
		AssignmentID: "asg-1",
		DriverID:     "drv-1",
		VehicleID:    "veh-1",
		DeliveryIDs:  []string{"d1", "d2"},
	})
	if err != nil {
		t.Fatalf("build message: %v", err)
	}
	if err := h.Broadcast(ctx, hub.VehicleRoom("veh-1"), msg); err != nil {
		t.Fatalf("broadcast: %v", err)
	}

	if driverSink.count() != 1 {
		t.Fatalf("assigned driver expected 1 notification, got %d", driverSink.count())
	}
	if otherSink.count() != 0 {
		t.Fatalf("unrelated driver must not be notified, got %d", otherSink.count())
	}
	var got hub.AssignmentEvent
	if err := json.Unmarshal(driverSink.messages[0].Data, &got); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if got.AssignmentID != "asg-1" || len(got.DeliveryIDs) != 2 {
		t.Fatalf("unexpected assignment payload: %+v", got)
	}
}
