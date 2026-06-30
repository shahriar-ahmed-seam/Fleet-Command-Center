package ingest_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/fleet-command-center/services/ingestion/internal/ingest"
)

// TestIngestionThroughput is a performance smoke test for the ingestion hot
// many vehicles through the in-memory service and asserts that every accepted
// ping is persisted and that the average per-ping ingest latency stays well
// under the 500 ms acknowledgement budget. It is not a substitute for a
// distributed load test, but guards against gross regressions in the hot path.
func TestIngestionThroughput(t *testing.T) {
	const (
		vehicles    = 500
		perVehicle  = 100 // 50,000 pings total
		totalPings  = vehicles * perVehicle
		ackBudget   = 500 * time.Millisecond
	)

	store := ingest.NewMemoryStore()
	svc := ingest.NewService(store, ingest.NewMemoryHighWaterMark(), &ingest.CollectingPublisher{})
	ctx := context.Background()
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	start := time.Now()
	accepted := 0
	for v := 0; v < vehicles; v++ {
		vehicleID := fmt.Sprintf("veh-%d", v)
		for i := 0; i < perVehicle; i++ {
			// Monotonic per-vehicle timestamps so none are discarded as stale.
			ts := base.Add(time.Duration(i) * time.Second).Format(time.RFC3339)
			res, err := svc.Ingest(ctx, validRequest(vehicleID, ts))
			if err != nil {
				t.Fatalf("ingest error: %v", err)
			}
			if res.Status == ingest.Accepted {
				accepted++
			}
		}
	}
	elapsed := time.Since(start)

	if accepted != totalPings {
		t.Fatalf("expected all %d pings accepted, got %d", totalPings, accepted)
	}
	if store.Count() != totalPings {
		t.Fatalf("expected %d persisted pings, got %d", totalPings, store.Count())
	}

	avg := elapsed / time.Duration(totalPings)
	if avg >= ackBudget {
		t.Fatalf("average ingest latency %v exceeds the %v ack budget", avg, ackBudget)
	}

	rate := float64(totalPings) / elapsed.Seconds()
	t.Logf("ingested %d pings in %v (%.0f pings/s, avg %v/ping)", totalPings, elapsed, rate, avg)
	// Sanity floor: the in-memory hot path should clear well above 5,000 pings/s.
	if rate < 5000 {
		t.Fatalf("throughput %.0f pings/s below the 5,000 pings/s target", rate)
	}
}
