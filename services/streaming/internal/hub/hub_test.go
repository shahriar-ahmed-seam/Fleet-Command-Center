package hub_test

import (
	"context"
	"sync"
	"testing"

	"github.com/fleet-command-center/services/streaming/internal/hub"
)

// collectingSink records every message delivered to a client.
type collectingSink struct {
	mu   sync.Mutex
	msgs []hub.Message
}

func (c *collectingSink) Deliver(m hub.Message) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.msgs = append(c.msgs, m)
}

func (c *collectingSink) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.msgs)
}

// fanoutPubSub simulates Redis Pub/Sub: a Publish on any replica is delivered
// to every subscribed replica's handler, so it can model cross-replica fan-out.
type fanoutPubSub struct {
	mu       sync.Mutex
	handlers []func(hub.Envelope)
}

func (f *fanoutPubSub) Subscribe(_ context.Context, h func(hub.Envelope)) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.handlers = append(f.handlers, h)
	return nil
}

func (f *fanoutPubSub) Publish(_ context.Context, env hub.Envelope) error {
	f.mu.Lock()
	hs := append([]func(hub.Envelope){}, f.handlers...)
	f.mu.Unlock()
	for _, h := range hs {
		h(env)
	}
	return nil
}

func (f *fanoutPubSub) Close() error { return nil }

func mustPosition(t *testing.T, vehicleID string) hub.Message {
	t.Helper()
	msg, err := hub.PositionMessage(hub.PositionEvent{
		VehicleID: vehicleID, Lat: 1, Lng: 2, Timestamp: "2024-01-01T00:00:00Z",
	})
	if err != nil {
		t.Fatalf("build position message: %v", err)
	}
	return msg
}

func newStartedHub(t *testing.T) *hub.Hub {
	t.Helper()
	h := hub.New(hub.NewLocalPubSub())
	if err := h.Start(context.Background()); err != nil {
		t.Fatalf("start hub: %v", err)
	}
	return h
}

// A subscribed client receives broadcasts for its room; an unsubscribed client
func TestSubscribedClientReceivesRelevantBroadcastOnly(t *testing.T) {
	h := newStartedHub(t)

	subbed := &collectingSink{}
	other := &collectingSink{}
	h.Connect("c1", "s1", subbed)
	h.Connect("c2", "s2", other)

	h.Subscribe("c1", hub.KindVehicle, "veh-1")

	if err := h.Broadcast(context.Background(), hub.VehicleRoom("veh-1"), mustPosition(t, "veh-1")); err != nil {
		t.Fatalf("broadcast: %v", err)
	}

	if subbed.count() != 1 {
		t.Fatalf("subscribed client got %d messages, want 1", subbed.count())
	}
	if other.count() != 0 {
		t.Fatalf("unsubscribed client got %d messages, want 0", other.count())
	}
}

// Unsubscribing stops delivery and forgets the persisted subscription.
func TestUnsubscribeStopsDelivery(t *testing.T) {
	h := newStartedHub(t)
	sink := &collectingSink{}
	h.Connect("c1", "s1", sink)
	h.Subscribe("c1", hub.KindDelivery, "del-9")
	h.Unsubscribe("c1", hub.KindDelivery, "del-9")

	_ = h.Broadcast(context.Background(), hub.DeliveryRoom("del-9"), mustPosition(t, "veh-1"))

	if sink.count() != 0 {
		t.Fatalf("got %d messages after unsubscribe, want 0", sink.count())
	}
	if subs := h.SessionSubscriptions("s1"); len(subs) != 0 {
		t.Fatalf("expected no persisted subscriptions, got %v", subs)
	}
}

func TestDisconnectReleasesResources(t *testing.T) {
	h := newStartedHub(t)
	sink := &collectingSink{}
	h.Connect("c1", "s1", sink)
	h.Subscribe("c1", hub.KindVehicle, "veh-1")

	if h.RoomSize(hub.VehicleRoom("veh-1")) != 1 {
		t.Fatalf("expected 1 member before disconnect")
	}
	if h.Status("s1") != hub.StatusConnected {
		t.Fatalf("expected connected status before disconnect")
	}

	h.Disconnect("c1")

	if h.RoomSize(hub.VehicleRoom("veh-1")) != 0 {
		t.Fatalf("disconnect must release room membership, got %d", h.RoomSize(hub.VehicleRoom("veh-1")))
	}
	if h.Status("s1") != hub.StatusDisconnected {
		t.Fatalf("expected disconnected status after disconnect, got %v", h.Status("s1"))
	}

	_ = h.Broadcast(context.Background(), hub.VehicleRoom("veh-1"), mustPosition(t, "veh-1"))
	if sink.count() != 0 {
		t.Fatalf("disconnected client must not receive broadcasts, got %d", sink.count())
	}
}

// On reconnect with the same session key, prior subscriptions are restored and
func TestReconnectResumesSubscriptions(t *testing.T) {
	h := newStartedHub(t)
	first := &collectingSink{}
	h.Connect("c1", "session-A", first)
	h.Subscribe("c1", hub.KindVehicle, "veh-1")
	h.Subscribe("c1", hub.KindDelivery, "del-2")

	h.Disconnect("c1")

	// Reconnect the same session on a new physical connection.
	second := &collectingSink{}
	resumed := h.Connect("c2", "session-A", second)

	rooms := map[string]bool{}
	for _, r := range resumed.Rooms() {
		rooms[r] = true
	}
	if !rooms[hub.VehicleRoom("veh-1")] || !rooms[hub.DeliveryRoom("del-2")] {
		t.Fatalf("reconnect did not resume prior rooms, got %v", resumed.Rooms())
	}

	_ = h.Broadcast(context.Background(), hub.VehicleRoom("veh-1"), mustPosition(t, "veh-1"))
	_ = h.Broadcast(context.Background(), hub.DeliveryRoom("del-2"), mustPosition(t, "veh-1"))

	if second.count() != 2 {
		t.Fatalf("resumed connection got %d messages, want 2", second.count())
	}
	if first.count() != 0 {
		t.Fatalf("old connection must not receive after disconnect, got %d", first.count())
	}
}

// The connection-status signal flips connected → disconnected and notifies
func TestConnectionStatusSignalNotifiesListeners(t *testing.T) {
	h := newStartedHub(t)

	var mu sync.Mutex
	transitions := []hub.ConnectionStatus{}
	h.OnStatusChange(func(_ string, s hub.ConnectionStatus) {
		mu.Lock()
		transitions = append(transitions, s)
		mu.Unlock()
	})

	h.Connect("c1", "s1", &collectingSink{})
	h.Disconnect("c1")

	mu.Lock()
	defer mu.Unlock()
	if len(transitions) != 2 ||
		transitions[0] != hub.StatusConnected ||
		transitions[1] != hub.StatusDisconnected {
		t.Fatalf("unexpected status transitions: %v", transitions)
	}
}

func TestDashboardRoomReceivesZoneEvents(t *testing.T) {
	h := newStartedHub(t)
	sink := &collectingSink{}
	h.Connect("c1", "s1", sink)
	h.SubscribeRoom("c1", hub.DashboardRoom)

	msg, err := hub.ZoneEvent(hub.ZoneEventMessage{
		VehicleID: "veh-1", ZoneID: "zone-1", Type: "Enter", Timestamp: "2024-01-01T00:00:00Z",
	})
	if err != nil {
		t.Fatalf("build zone event: %v", err)
	}
	_ = h.Broadcast(context.Background(), hub.DashboardRoom, msg)

	if sink.count() != 1 {
		t.Fatalf("dashboard client got %d zone events, want 1", sink.count())
	}
}

// A message published on one replica reaches a client connected to another
func TestCrossReplicaFanout(t *testing.T) {
	broker := &fanoutPubSub{}
	replicaA := hub.New(broker)
	replicaB := hub.New(broker)
	if err := replicaA.Start(context.Background()); err != nil {
		t.Fatalf("start A: %v", err)
	}
	if err := replicaB.Start(context.Background()); err != nil {
		t.Fatalf("start B: %v", err)
	}

	// Client is connected to replica B and subscribed to a vehicle room.
	sink := &collectingSink{}
	replicaB.Connect("c1", "s1", sink)
	replicaB.Subscribe("c1", hub.KindVehicle, "veh-7")

	// The ping is accepted/broadcast on replica A.
	if err := replicaA.Broadcast(context.Background(), hub.VehicleRoom("veh-7"), mustPosition(t, "veh-7")); err != nil {
		t.Fatalf("broadcast on A: %v", err)
	}

	if sink.count() != 1 {
		t.Fatalf("cross-replica delivery failed: client got %d messages, want 1", sink.count())
	}
}
