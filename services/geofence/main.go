// Package main is the entry point for the Geofence_Engine.
//
// The Geofence_Engine consumes accepted-ping events from the queue, evaluates
// each against defined zones using PostGIS containment (inside-or-boundary),
// compares prior membership, and emits Enter/Exit Zone_Events on membership
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/fleet-command-center/services/geofence/internal/geofence"
)

func main() {
	addr := envOr("GEOFENCE_ADDR", ":8083")

	// Local wiring uses an in-memory zone catalog and membership store;
	// production swaps in geofence.NewPostGISCatalog(db) (ST_Contains/ST_Touches)
	// and a Redis/PostGIS-backed membership store and queue publisher. The engine
	// is constructed here to validate wiring and document usage; the queue
	// consumer loop that feeds OnAcceptedPing is provided by the transport layer.
	engine = geofence.NewEngine(
		geofence.NewInMemoryCatalog(),
		geofence.WithPublisher(&geofence.CollectingPublisher{}),
	)
	_ = engine

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"geofence"}`))
	})

	log.Printf("geofence service listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("geofence service failed: %v", err)
	}
}

// engine is the constructed Geofence_Engine; the queue consumer drives it via
// OnAcceptedPing for each accepted ping.
var engine *geofence.Engine

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
