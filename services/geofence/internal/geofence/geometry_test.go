package geofence_test

import (
	"testing"

	"github.com/fleet-command-center/services/geofence/internal/geofence"
)

func unitSquare() geofence.Polygon {
	return geofence.Polygon{Vertices: []geofence.Point{
		{Lat: 0, Lng: 0},
		{Lat: 0, Lng: 10},
		{Lat: 10, Lng: 10},
		{Lat: 10, Lng: 0},
	}}
}

func TestContainsInclusive(t *testing.T) {
	poly := unitSquare()
	cases := []struct {
		name string
		p    geofence.Point
		want bool
	}{
		{"interior", geofence.Point{Lat: 5, Lng: 5}, true},
		{"bottom edge", geofence.Point{Lat: 0, Lng: 5}, true},
		{"left edge", geofence.Point{Lat: 5, Lng: 0}, true},
		{"top edge", geofence.Point{Lat: 10, Lng: 5}, true},
		{"right edge", geofence.Point{Lat: 5, Lng: 10}, true},
		{"corner vertex", geofence.Point{Lat: 0, Lng: 0}, true},
		{"corner vertex 2", geofence.Point{Lat: 10, Lng: 10}, true},
		{"strictly outside right", geofence.Point{Lat: 5, Lng: 11}, false},
		{"strictly outside below", geofence.Point{Lat: -1, Lng: 5}, false},
		{"far outside", geofence.Point{Lat: 100, Lng: 100}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := poly.ContainsInclusive(tc.p); got != tc.want {
				t.Fatalf("ContainsInclusive(%+v) = %v, want %v", tc.p, got, tc.want)
			}
		})
	}
}

func TestContainsInclusiveClosedRing(t *testing.T) {
	// A ring whose first vertex repeats as the last must behave identically.
	closed := geofence.Polygon{Vertices: []geofence.Point{
		{Lat: 0, Lng: 0},
		{Lat: 0, Lng: 10},
		{Lat: 10, Lng: 10},
		{Lat: 10, Lng: 0},
		{Lat: 0, Lng: 0},
	}}
	if !closed.ContainsInclusive(geofence.Point{Lat: 5, Lng: 5}) {
		t.Fatal("expected interior point inside closed ring")
	}
	if closed.ContainsInclusive(geofence.Point{Lat: 50, Lng: 50}) {
		t.Fatal("expected far point outside closed ring")
	}
}

func TestDegeneratePolygonContainsNothing(t *testing.T) {
	poly := geofence.Polygon{Vertices: []geofence.Point{{Lat: 0, Lng: 0}, {Lat: 1, Lng: 1}}}
	if poly.ContainsInclusive(geofence.Point{Lat: 0, Lng: 0}) {
		t.Fatal("polygon with <3 vertices should contain nothing")
	}
}
