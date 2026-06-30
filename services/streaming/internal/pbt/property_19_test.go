package pbt

import (
	"testing"

	"github.com/fleet-command-center/services/streaming/internal/hub"
	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"
)

// retained and retried up to three times.
//
// failures for a zone event, the Streaming_Service retains the event and
// retries delivery min(K, 3) times before giving up, never exceeding 3 retries.
func TestProperty19RetryBound(t *testing.T) {
	params := Params()
	properties := gopter.NewProperties(params)

	properties.Property(
		Tag(19, "Undelivered zone events are retained and retried up to three times"),
		prop.ForAll(func(failFirst int) bool {
			// A sender that fails its first `failFirst` calls, then succeeds.
			calls := 0
			send := func(hub.ZoneEventMessage) bool {
				calls++
				return calls > failFirst
			}
			delivery := hub.NewZoneEventDelivery(send)

			event := hub.ZoneEventMessage{VehicleID: "v", ZoneID: "z", Type: "Enter", Timestamp: "t"}
			retries, delivered := delivery.DeliverWithRetries(event)

			expectedRetries := failFirst
			if expectedRetries > hub.MaxZoneEventRetries {
				expectedRetries = hub.MaxZoneEventRetries
			}
			// Retries equal min(K,3) and never exceed 3.
			if retries != expectedRetries || retries > hub.MaxZoneEventRetries {
				return false
			}
			// Delivered iff the success arrives within the initial+3 attempts.
			return delivered == (failFirst <= hub.MaxZoneEventRetries)
		}, gen.IntRange(0, 10)),
	)

	properties.TestingRun(t)
}
