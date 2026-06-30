package pbt_test

import (
	"context"
	"testing"
	"time"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"

	"github.com/fleet-command-center/services/geofence/internal/geofence"
	"github.com/fleet-command-center/services/geofence/internal/pbt"
)

// if membership changes.
//
// For any zone and any consecutive pair of accepted pings for a vehicle, the
// Geofence_Engine generates an Enter event exactly when the vehicle moves from
// outside to inside-or-on-boundary, an Exit event exactly when it moves from
// inside to strictly outside, and no event when membership is unchanged.
//
// The test drives the engine over a generated sequence of points against an
// axis-aligned rectangular zone and checks the emitted events against an
// INDEPENDENT membership oracle (min/max bounds comparison), distinct from the
// engine's ray-casting containment. Point categories deliberately include
// points exactly on the polygon boundary (edges and vertices).
//
func TestProperty16MembershipChangeEvents(t *testing.T) {
	properties := gopter.NewProperties(pbt.Params())

	properties.Property(pbt.Tag(16,
		"geo-fence events fire iff membership changes"),
		prop.ForAll(
			func(baseLng, baseLat, width, height int, categories []int) bool {
				minLng := float64(baseLng)
				minLat := float64(baseLat)
				maxLng := minLng + float64(width)
				maxLat := minLat + float64(height)

				// Axis-aligned rectangle zone (CCW), evaluated by the engine's
				// general ray-casting containment with boundary inclusion.
				zone := geofence.Zone{
					ID: "zone-rect",
					Polygon: geofence.Polygon{Vertices: []geofence.Point{
						{Lat: minLat, Lng: minLng},
						{Lat: minLat, Lng: maxLng},
						{Lat: maxLat, Lng: maxLng},
						{Lat: maxLat, Lng: minLng},
					}},
				}
				eng := geofence.NewEngine(geofence.NewInMemoryCatalog(zone))
				ctx := context.Background()
				const vehicleID = "veh-1"
				base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

				// coordFor maps a category 0..4 to a coordinate relative to the
				// [lo, hi] edge values: below / on-min-edge / interior /
				// on-max-edge / above.
				coordFor := func(cat int, lo, hi float64) float64 {
					switch cat {
					case 0:
						return lo - 1 // strictly below
					case 1:
						return lo // on the min boundary
					case 2:
						return lo + (hi-lo)/2 // interior
					case 3:
						return hi // on the max boundary
					default:
						return hi + 1 // strictly above
					}
				}

				priorInside := false
				havePrior := false

				for _, c := range categories {
					latCat := c / 5
					lngCat := c % 5
					lat := coordFor(latCat, minLat, maxLat)
					lng := coordFor(lngCat, minLng, maxLng)

					// Independent oracle: inside-or-boundary iff both coordinates
					// fall within the inclusive [min, max] range.
					expectInside := latCat >= 1 && latCat <= 3 && lngCat >= 1 && lngCat <= 3

					events, err := eng.OnAcceptedPing(ctx, geofence.AcceptedPing{
						VehicleID: vehicleID,
						Lat:       lat,
						Lng:       lng,
						Timestamp: base,
					})
					if err != nil {
						return false
					}

					// First ping: prior membership is "outside" (no record), so
					// an Enter fires iff the point is inside.
					changed := !havePrior && expectInside
					if havePrior {
						changed = expectInside != priorInside
					}

					if !changed {
						if len(events) != 0 {
							return false
						}
					} else {
						if len(events) != 1 {
							return false
						}
						wantType := geofence.EventExit
						if expectInside {
							wantType = geofence.EventEnter
						}
						if events[0].Type != wantType || events[0].ZoneID != zone.ID {
							return false
						}
					}

					priorInside = expectInside
					havePrior = true
				}

				return true
			},
			gen.IntRange(-50, 50),
			gen.IntRange(-50, 50),
			gen.IntRange(2, 20),
			gen.IntRange(2, 20),
			// Sequences favor frequent membership flips and boundary hits since
			// each category covers below/on-min/interior/on-max/above.
			gen.SliceOf(gen.IntRange(0, 24)),
		))

	properties.TestingRun(t)
}
