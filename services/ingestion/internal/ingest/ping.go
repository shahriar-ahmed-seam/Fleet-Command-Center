// Package ingest implements the Ingestion_Service hot path: validating
// Location_Pings, enforcing per-vehicle monotonic ordering, persisting accepted
// pings with their telemetry, and publishing an accepted-ping event to the
// 14.5).
package ingest

import (
	"strings"
	"time"
)

const (
	LatMin = -90.0
	LatMax = 90.0
	LngMin = -180.0
	LngMax = 180.0
)

// Telemetry is the optional vehicle operational data accompanying a ping
type Telemetry struct {
	Speed   *float64 `json:"speed,omitempty"`
	Heading *float64 `json:"heading,omitempty"`
	Battery *float64 `json:"battery,omitempty"`
}

// PingRequest is the wire payload a client posts for one Location_Ping. Pointer
// fields let validation detect a missing latitude/longitude/timestamp rather
type PingRequest struct {
	VehicleID *string    `json:"vehicleId"`
	Lat       *float64   `json:"lat"`
	Lng       *float64   `json:"lng"`
	Timestamp *string    `json:"timestamp"`
	Telemetry *Telemetry `json:"telemetry,omitempty"`
}

// timestampLayouts accepted for the event timestamp, most precise first.
var timestampLayouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
}

// parseTimestamp parses an ISO-8601 event timestamp, reporting whether it was
// well-formed.
func parseTimestamp(s string) (time.Time, bool) {
	for _, layout := range timestampLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}

// fieldSet collects offending field names without duplicates, preserving the
// order in which they were first reported.
type fieldSet struct {
	seen  map[string]bool
	order []string
}

func newFieldSet() *fieldSet { return &fieldSet{seen: map[string]bool{}} }

func (f *fieldSet) add(name string) {
	if !f.seen[name] {
		f.seen[name] = true
		f.order = append(f.order, name)
	}
}

// result means the ping is structurally valid. A missing coordinate is reported
// once (as missing), not also as out-of-range.
func Validate(p PingRequest) []string {
	fields := newFieldSet()

	if p.VehicleID == nil || strings.TrimSpace(*p.VehicleID) == "" {
		fields.add("vehicleId")
	}

	latMissing := p.Lat == nil
	if latMissing {
		fields.add("lat")
	}
	lngMissing := p.Lng == nil
	if lngMissing {
		fields.add("lng")
	}

	tsMissing := p.Timestamp == nil || strings.TrimSpace(*p.Timestamp) == ""
	if !tsMissing {
		if _, ok := parseTimestamp(*p.Timestamp); !ok {
			tsMissing = true
		}
	}
	if tsMissing {
		fields.add("timestamp")
	}

	if !latMissing && (*p.Lat < LatMin || *p.Lat > LatMax) {
		fields.add("lat")
	}
	if !lngMissing && (*p.Lng < LngMin || *p.Lng > LngMax) {
		fields.add("lng")
	}

	return fields.order
}
