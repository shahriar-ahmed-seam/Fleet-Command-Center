// Package main is the entry point for the Ingestion_Service.
//
// The Ingestion_Service receives, validates, and persists Location_Ping
// telemetry from driver devices (the hot path), then publishes accepted
// pings to the queue for downstream geo-fence and streaming consumers.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/fleet-command-center/services/ingestion/internal/ingest"
)

func main() {
	addr := envOr("INGESTION_ADDR", ":8081")

	// Local wiring uses in-memory adapters; production swaps in PostGIS, the
	// Redis-backed high-water mark, and the queue publisher. A nil publisher
	// degrades to a no-op so persistence proceeds even with no streaming
	svc := ingest.NewService(
		ingest.NewMemoryStore(),
		ingest.NewMemoryHighWaterMark(),
		nil,
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"ingestion"}`))
	})
	mux.Handle("/v1/pings", ingest.Handler(svc))

	log.Printf("ingestion service listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("ingestion service failed: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
