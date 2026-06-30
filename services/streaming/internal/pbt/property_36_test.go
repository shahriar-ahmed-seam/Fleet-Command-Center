package pbt

import (
	"context"
	"sort"
	"testing"

	"github.com/fleet-command-center/services/streaming/internal/hub"
	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"
)

// collectingSink records delivered messages for assertions.
type collectingSink struct{ received []hub.Message }

func (s *collectingSink) Deliver(m hub.Message) { s.received = append(s.received, m) }

// relevant updates and survive reconnect.
//
// set of vehicles, the hub delivers every relevant update and no irrelevant
// one; on disconnect it releases the room resources; and on reconnect it
// restores the client's prior subscriptions.
func TestProperty36SubscriptionsAndResume(t *testing.T) {
	params := Params()
	properties := gopter.NewProperties(params)

	properties.Property(
		Tag(36, "Subscriptions deliver exactly the relevant updates and survive reconnect"),
		prop.ForAll(func(subIDs []string, otherID string) bool {
			ctx := context.Background()
			h := hub.New(hub.NewLocalPubSub())
			if err := h.Start(ctx); err != nil {
				return false
			}

			sink := &collectingSink{}
			h.Connect("conn-1", "session-1", sink)
			uniqueSubs := unique(subIDs)
			for _, id := range uniqueSubs {
				h.Subscribe("conn-1", hub.KindVehicle, id)
			}

			// 1) Relevant delivery: broadcasting to a subscribed vehicle reaches
			//    the client; an unsubscribed vehicle does not.
			for _, id := range uniqueSubs {
				msg, _ := hub.PositionMessage(hub.PositionEvent{VehicleID: id})
				_ = h.Broadcast(ctx, hub.VehicleRoom(id), msg)
			}
			if !contains(uniqueSubs, otherID) {
				msg, _ := hub.PositionMessage(hub.PositionEvent{VehicleID: otherID})
				_ = h.Broadcast(ctx, hub.VehicleRoom(otherID), msg)
			}
			// Exactly one message per (unique) subscribed vehicle, none for other.
			if len(sink.received) != len(uniqueSubs) {
				return false
			}

			h.Disconnect("conn-1")
			for _, id := range uniqueSubs {
				if h.RoomSize(hub.VehicleRoom(id)) != 0 {
					return false
				}
			}

			h.Connect("conn-2", "session-1", &collectingSink{})
			resumed := h.SessionSubscriptions("session-1")
			sort.Strings(resumed)
			want := make([]string, 0, len(uniqueSubs))
			for _, id := range uniqueSubs {
				want = append(want, hub.VehicleRoom(id))
			}
			sort.Strings(want)
			return equal(resumed, want)
		}, gen.SliceOf(gen.Identifier()), gen.Identifier()),
	)

	properties.TestingRun(t)
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func unique(xs []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, x := range xs {
		if !seen[x] {
			seen[x] = true
			out = append(out, x)
		}
	}
	return out
}

func equal(a, b []string) bool {
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
