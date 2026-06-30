package pbt_test

import (
	"context"
	"testing"
	"time"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"

	"github.com/fleet-command-center/services/ingestion/internal/ingest"
	"github.com/fleet-command-center/services/ingestion/internal/pbt"
)

// ptr builds optional request fields.
func ptr[T any](v T) *T { return &v }

// monotonic; stale pings are discarded.
//
// For any sequence of pings for a vehicle, the persisted latest ping is the one
// with the maximum accepted timestamp, and any ping whose timestamp is older
// than the current per-vehicle high-water mark is discarded without altering
// stored state.
//
func TestProperty11MonotonicOrdering(t *testing.T) {
	properties := gopter.NewProperties(pbt.Params())

	properties.Property(pbt.Tag(11,
		"per-vehicle ping ordering is monotonic; stale pings are discarded"),
		prop.ForAll(
			func(offsets []int) bool {
				store := ingest.NewMemoryStore()
				hwm := ingest.NewMemoryHighWaterMark()
				svc := ingest.NewService(store, hwm, &ingest.CollectingPublisher{})

				base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
				const vehicleID = "veh-1"

				var runningMax time.Time
				hasMax := false
				accepted := 0

				// Timestamps arrive shuffled and with duplicates (random offsets).
				for _, off := range offsets {
					ts := base.Add(time.Duration(off) * time.Second)
					req := ingest.PingRequest{
						VehicleID: ptr(vehicleID),
						Lat:       ptr(10.0),
						Lng:       ptr(20.0),
						Timestamp: ptr(ts.Format(time.RFC3339Nano)),
					}
					res, err := svc.Ingest(context.Background(), req)
					if err != nil {
						return false
					}

					stale := hasMax && ts.Before(runningMax)
					if stale {
						// Stale pings are discarded and not persisted.
						if res.Status != ingest.Stale {
							return false
						}
					} else {
						// Fresh (>= high-water mark) pings are accepted.
						if res.Status != ingest.Accepted {
							return false
						}
						accepted++
						if !hasMax || ts.After(runningMax) {
							runningMax = ts
							hasMax = true
						}
					}
				}

				// The high-water mark equals the maximum accepted timestamp.
				if hasMax {
					latest, ok := hwm.Latest(vehicleID)
					if !ok || !latest.Equal(runningMax) {
						return false
					}
				}
				// Exactly the non-stale pings were persisted; stale ones left
				// stored state unchanged.
				return store.Count() == accepted
			},
			// Small offset range guarantees frequent duplicate and out-of-order
			// timestamps within each generated sequence.
			gen.SliceOf(gen.IntRange(0, 30)),
		))

	properties.TestingRun(t)
}
