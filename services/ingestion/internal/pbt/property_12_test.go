package pbt_test

import (
	"context"
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"

	"github.com/fleet-command-center/services/ingestion/internal/ingest"
	"github.com/fleet-command-center/services/ingestion/internal/pbt"
)

// staticDriver resolves every vehicle to a fixed driver id so the round-trip
type staticDriver struct{ id string }

func (s staticDriver) DriverForVehicle(string) (string, bool) { return s.id, true }

// floatEq compares two float64 values for exact round-trip equality.
func floatEq(a, b float64) bool { return a == b || (math.IsNaN(a) && math.IsNaN(b)) }

// included telemetry (round-trip).
//
// For any valid ping with an arbitrary subset of telemetry fields, persisting
// then reading the ping returns the same coordinates, timestamp, and telemetry
// values, linked to the correct vehicle and driver.
//
func TestProperty12TelemetryRoundTrip(t *testing.T) {
	properties := gopter.NewProperties(pbt.Params())

	properties.Property(pbt.Tag(12,
		"accepted pings persist with their included telemetry (round-trip)"),
		prop.ForAll(
			func(vehSeq int, lat, lng, speed, heading, battery float64,
				hasSpeed, hasHeading, hasBattery bool, tsOffset int) bool {

				const driverID = "drv-1"
				store := ingest.NewMemoryStore()
				svc := ingest.NewService(
					store, ingest.NewMemoryHighWaterMark(), &ingest.CollectingPublisher{},
					ingest.WithDriverResolver(staticDriver{id: driverID}),
				)

				vehicleID := fmt.Sprintf("veh-%d", vehSeq)
				ts := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC).
					Add(time.Duration(tsOffset) * time.Millisecond).UTC()

				// Build an arbitrary subset of telemetry fields.
				var tel *ingest.Telemetry
				if hasSpeed || hasHeading || hasBattery {
					tel = &ingest.Telemetry{}
					if hasSpeed {
						tel.Speed = ptr(speed)
					}
					if hasHeading {
						tel.Heading = ptr(heading)
					}
					if hasBattery {
						tel.Battery = ptr(battery)
					}
				}

				req := ingest.PingRequest{
					VehicleID: ptr(vehicleID),
					Lat:       ptr(lat),
					Lng:       ptr(lng),
					Timestamp: ptr(ts.Format(time.RFC3339Nano)),
					Telemetry: tel,
				}

				res, err := svc.Ingest(context.Background(), req)
				if err != nil || res.Status != ingest.Accepted {
					return false
				}

				stored, ok := store.Get(res.PingID)
				if !ok {
					return false
				}

				// Vehicle/driver attribution and coordinates/timestamp round-trip.
				if stored.VehicleID != vehicleID || stored.DriverID != driverID {
					return false
				}
				if !floatEq(stored.Lat, lat) || !floatEq(stored.Lng, lng) {
					return false
				}
				if !stored.Timestamp.Equal(ts) {
					return false
				}

				// Telemetry subset round-trips exactly: present fields match,
				// omitted fields stay omitted.
				if tel == nil {
					return stored.Telemetry == nil
				}
				if stored.Telemetry == nil {
					return false
				}
				if !optFloatEq(stored.Telemetry.Speed, tel.Speed) ||
					!optFloatEq(stored.Telemetry.Heading, tel.Heading) ||
					!optFloatEq(stored.Telemetry.Battery, tel.Battery) {
					return false
				}
				return true
			},
			gen.IntRange(0, 100000),         // vehicle sequence
			gen.Float64Range(-90, 90),       // lat (valid range)
			gen.Float64Range(-180, 180),     // lng (valid range)
			gen.Float64Range(0, 240),        // speed
			gen.Float64Range(0, 360),        // heading
			gen.Float64Range(0, 100),        // battery
			gen.Bool(),                      // include speed
			gen.Bool(),                      // include heading
			gen.Bool(),                      // include battery
			gen.IntRange(0, 1_000_000_000),  // timestamp offset (ms)
		))

	properties.TestingRun(t)
}

// optFloatEq compares two optional floats for exact round-trip equality.
func optFloatEq(a, b *float64) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return floatEq(*a, *b)
}
