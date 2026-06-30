// Package main is the entry point for the Streaming_Service.
//
// The Streaming_Service broadcasts real-time position updates and zone
// events to subscribed clients over WebSocket, manages room-keyed
// subscriptions (vehicle:{id}, delivery:{id}, dashboard:global), releases
// resources on disconnect, resumes prior subscriptions on reconnect, surfaces
// a connection-status signal, and fans messages out across replicas via Redis
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/redis/go-redis/v9"

	"github.com/fleet-command-center/services/streaming/internal/hub"
	"github.com/fleet-command-center/services/streaming/internal/transport"
)

func main() {
	addr := envOr("STREAMING_ADDR", ":8082")
	ctx := context.Background()

	// Cross-replica fan-out uses Redis Pub/Sub when REDIS_ADDR is set; otherwise
	// a single-node in-process transport is used for local development.
	ps := buildPubSub(ctx)
	defer func() { _ = ps.Close() }()

	h := hub.New(ps)
	if err := h.Start(ctx); err != nil {
		log.Fatalf("streaming hub failed to start: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"streaming"}`))
	})
	mux.Handle("/v1/stream", transport.Handler(h))
	mux.Handle("/v1/connection", transport.StatusHandler(h))

	log.Printf("streaming service listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("streaming service failed: %v", err)
	}
}

// buildPubSub selects the Redis-backed fan-out when REDIS_ADDR is configured,
// falling back to the in-process transport otherwise.
func buildPubSub(ctx context.Context) hub.PubSub {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		log.Print("streaming: REDIS_ADDR unset, using in-process pub/sub (single node)")
		return hub.NewLocalPubSub()
	}
	client := redis.NewClient(&redis.Options{Addr: redisAddr})
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("streaming: redis ping failed (%v), falling back to in-process pub/sub", err)
		_ = client.Close()
		return hub.NewLocalPubSub()
	}
	log.Printf("streaming: using redis pub/sub fan-out at %s", redisAddr)
	return hub.NewRedisPubSub(client, hub.DefaultChannel)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
