package hub_test

import (
	"context"
	"testing"

	"github.com/fleet-command-center/services/streaming/internal/hub"
)

// failNTimesSender returns a ZoneEventSender that fails its first n delivery
// attempts and succeeds on every attempt thereafter, recording the total number
// of attempts made.
func failNTimesSender(n int) (hub.ZoneEventSender, *int) {
	attempts := 0
	send := func(hub.ZoneEventMessage) bool {
		attempts++
		return attempts > n
	}
	return send, &attempts
}

func sampleZoneEvent() hub.ZoneEventMessage {
	return hub.ZoneEventMessage{
		VehicleID: "veh-1",
		ZoneID:    "zone-1",
		Type:      "Enter",
		Timestamp: "2024-01-01T00:00:00Z",
	}
}

// A zone event delivered on the first attempt is not retained and triggers no
// retries.
func TestDeliverSucceedsFirstAttempt(t *testing.T) {
	send, attempts := failNTimesSender(0)
	d := hub.NewZoneEventDelivery(send)

	if !d.Deliver(sampleZoneEvent()) {
		t.Fatalf("expected initial delivery to succeed")
	}
	if d.Pending() != 0 {
		t.Fatalf("expected no retained events, got %d", d.Pending())
	}
	if *attempts != 1 {
		t.Fatalf("expected 1 delivery attempt, got %d", *attempts)
	}
}

func TestFailedDeliveryIsRetained(t *testing.T) {
	send, _ := failNTimesSender(1) // first attempt fails
	d := hub.NewZoneEventDelivery(send)

	if d.Deliver(sampleZoneEvent()) {
		t.Fatalf("expected initial delivery to fail")
	}
	if d.Pending() != 1 {
		t.Fatalf("expected 1 retained event, got %d", d.Pending())
	}
}

// A retained event that succeeds on a later retry is delivered and dropped from
func TestRetryDeliversAndClearsQueue(t *testing.T) {
	send, attempts := failNTimesSender(1) // only the initial attempt fails
	d := hub.NewZoneEventDelivery(send)

	d.Deliver(sampleZoneEvent()) // fails, retained
	if remaining := d.Retry(); remaining != 0 {
		t.Fatalf("expected queue cleared after successful retry, got %d pending", remaining)
	}
	if *attempts != 2 {
		t.Fatalf("expected 2 attempts (initial + 1 retry), got %d", *attempts)
	}
}

// An event whose deliveries always fail is retried exactly three times and then
func TestRetriesAreBoundedToThree(t *testing.T) {
	send, attempts := failNTimesSender(1_000) // always fails
	d := hub.NewZoneEventDelivery(send)

	d.Deliver(sampleZoneEvent()) // initial attempt fails, retained

	// Drive retries until the queue drains; count the retry passes.
	passes := 0
	for d.Pending() > 0 {
		d.Retry()
		passes++
		if passes > 10 {
			t.Fatalf("retry loop did not terminate; queue still has %d", d.Pending())
		}
	}

	if passes != hub.MaxZoneEventRetries {
		t.Fatalf("expected %d retry passes before giving up, got %d", hub.MaxZoneEventRetries, passes)
	}
	// 1 initial attempt + 3 retry attempts.
	if *attempts != hub.MaxZoneEventRetries+1 {
		t.Fatalf("expected %d total attempts, got %d", hub.MaxZoneEventRetries+1, *attempts)
	}
	if d.Pending() != 0 {
		t.Fatalf("expected event dropped after exhausting retries, got %d pending", d.Pending())
	}
}

// DeliverWithRetries performs min(K, 3) retries for K consecutive failures.
func TestDeliverWithRetriesCountsRetries(t *testing.T) {
	cases := []struct {
		name        string
		failFirst   int
		wantRetries int
		wantOK      bool
	}{
		{"succeeds immediately", 0, 0, true},
		{"one failure then success", 1, 1, true},
		{"two failures then success", 2, 2, true},
		{"three failures then success", 3, 3, true},
		{"always fails, capped at three", 100, 3, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			send, _ := failNTimesSender(tc.failFirst)
			d := hub.NewZoneEventDelivery(send)

			retries, ok := d.DeliverWithRetries(sampleZoneEvent())
			if retries != tc.wantRetries {
				t.Fatalf("retries = %d, want %d", retries, tc.wantRetries)
			}
			if ok != tc.wantOK {
				t.Fatalf("delivered = %v, want %v", ok, tc.wantOK)
			}
			if retries > hub.MaxZoneEventRetries {
				t.Fatalf("retries %d exceeded max %d", retries, hub.MaxZoneEventRetries)
			}
		})
	}
}

// The hub-backed sender reports failure when no dashboard client is connected
// (the event is then retained), and success once a subscriber is present.
func TestHubZoneEventSenderReflectsSubscribers(t *testing.T) {
	h := hub.New(hub.NewLocalPubSub())
	if err := h.Start(context.Background()); err != nil {
		t.Fatalf("start hub: %v", err)
	}
	send := hub.HubZoneEventSender(context.Background(), h, hub.DashboardRoom)
	d := hub.NewZoneEventDelivery(send)

	// No subscribers yet: initial delivery fails and is retained.
	if d.Deliver(sampleZoneEvent()) {
		t.Fatalf("expected delivery to fail with no subscribers")
	}
	if d.Pending() != 1 {
		t.Fatalf("expected event retained, got %d pending", d.Pending())
	}

	// A dashboard client connects and subscribes; the retry now succeeds.
	sink := &collectingSink{}
	h.Connect("c1", "s1", sink)
	h.SubscribeRoom("c1", hub.DashboardRoom)

	if remaining := d.Retry(); remaining != 0 {
		t.Fatalf("expected event delivered after subscriber joined, got %d pending", remaining)
	}
	if sink.count() != 1 {
		t.Fatalf("subscriber got %d zone events, want 1", sink.count())
	}
}
