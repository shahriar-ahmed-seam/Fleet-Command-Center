package pbt_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"

	"github.com/fleet-command-center/services/ingestion/internal/ingest"
	"github.com/fleet-command-center/services/ingestion/internal/pbt"
)

// unavailableStreaming mocks the Streaming_Service / queue being unavailable:
type unavailableStreaming struct{}

func (unavailableStreaming) Publish(context.Context, ingest.AcceptedPingEvent) error {
	return errors.New("streaming unavailable")
}

// when streaming is unavailable.
//
// For any valid ping received while the Streaming_Service is unavailable, the
// Ingestion_Service still persists and acknowledges the ping.
//
func TestProperty37PersistsWhenStreamingUnavailable(t *testing.T) {
	properties := gopter.NewProperties(pbt.Params())

	properties.Property(pbt.Tag(37,
		"ingestion persists pings even when streaming is unavailable"),
		prop.ForAll(
			func(vehSeq int, lat, lng float64, tsOffset int) bool {
				// Streaming/queue is down for the entire ingest.
				store := ingest.NewMemoryStore()
				svc := ingest.NewService(
					store, ingest.NewMemoryHighWaterMark(), unavailableStreaming{},
				)

				ts := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC).
					Add(time.Duration(tsOffset) * time.Millisecond)
				req := ingest.PingRequest{
					VehicleID: ptr(fmt.Sprintf("veh-%d", vehSeq)),
					Lat:       ptr(lat),
					Lng:       ptr(lng),
					Timestamp: ptr(ts.Format(time.RFC3339Nano)),
				}

				res, err := svc.Ingest(context.Background(), req)
				// A streaming/publish failure must never surface as an error or
				// block the acknowledgement.
				if err != nil {
					return false
				}
				if res.Status != ingest.Accepted {
					return false
				}
				// The ping was still persisted despite streaming being down.
				return store.Count() == 1
			},
			gen.IntRange(0, 100000),        // vehicle sequence
			gen.Float64Range(-90, 90),      // valid lat
			gen.Float64Range(-180, 180),    // valid lng
			gen.IntRange(0, 1_000_000_000), // timestamp offset (ms)
		))

	properties.TestingRun(t)
}
