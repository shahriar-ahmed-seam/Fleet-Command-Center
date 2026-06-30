package pbt_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"

	"github.com/fleet-command-center/services/geofence/internal/geofence"
	"github.com/fleet-command-center/services/geofence/internal/pbt"
)

// arrival label iff configured.
//
// For any generated zone event, the payload includes the zone's arrival label
// when the zone has one configured and omits it otherwise. The test generates
// zones with and without a configured arrival label, drives the engine through
// an Enter and an Exit, and asserts every emitted event (and its JSON payload)
// carries the label exactly when the zone configured one.
//
func TestProperty18ArrivalLabelPayload(t *testing.T) {
	properties := gopter.NewProperties(pbt.Params())

	properties.Property(pbt.Tag(18,
		"zone-event payload carries the arrival label iff configured"),
		prop.ForAll(
			func(configured bool, rawLabel string) bool {
				// A zone is "configured" with a label only when the flag is set
				label := strings.TrimSpace(rawLabel)
				hasLabel := configured && label != "" && len(label) <= 100

				var arrival *string
				if hasLabel {
					arrival = &label
				}

				zone := geofence.Zone{
					ID:           "zone-1",
					ArrivalLabel: arrival,
					Polygon: geofence.Polygon{Vertices: []geofence.Point{
						{Lat: 0, Lng: 0},
						{Lat: 0, Lng: 10},
						{Lat: 10, Lng: 10},
						{Lat: 10, Lng: 0},
					}},
				}
				eng := geofence.NewEngine(geofence.NewInMemoryCatalog(zone))
				ctx := context.Background()
				base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

				inside := geofence.AcceptedPing{VehicleID: "v1", Lat: 5, Lng: 5, Timestamp: base}
				outside := geofence.AcceptedPing{VehicleID: "v1", Lat: 99, Lng: 99, Timestamp: base}

				enter, err := eng.OnAcceptedPing(ctx, inside)
				if err != nil || len(enter) != 1 || enter[0].Type != geofence.EventEnter {
					return false
				}
				exit, err := eng.OnAcceptedPing(ctx, outside)
				if err != nil || len(exit) != 1 || exit[0].Type != geofence.EventExit {
					return false
				}

				for _, ev := range []geofence.ZoneEvent{enter[0], exit[0]} {
					if !labelMatches(ev, hasLabel, label) {
						return false
					}
				}
				return true
			},
			gen.Bool(),
			gen.AnyString(),
		))

	properties.TestingRun(t)
}

// labelMatches verifies an event's label field and its serialized JSON payload
// both reflect whether the zone configured an arrival label.
func labelMatches(ev geofence.ZoneEvent, hasLabel bool, label string) bool {
	if hasLabel {
		if ev.Label == nil || *ev.Label != label {
			return false
		}
	} else if ev.Label != nil {
		return false
	}

	// The wire payload includes the "label" key only when configured (omitempty).
	encoded, err := json.Marshal(ev)
	if err != nil {
		return false
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &fields); err != nil {
		return false
	}
	_, present := fields["label"]
	return present == hasLabel
}
