// Package transport bridges client WebSocket connections to the streaming Hub.
//
// It speaks a small JSON protocol matching the shared socket-event contract:
// clients send {event:"subscribe"|"unsubscribe", data:{kind,id}} frames, and
// the server pushes {event:"position"|"zoneEvent"|...} frames. Each connection
// carries a session key (query param) used to resume subscriptions on
package transport

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/fleet-command-center/services/streaming/internal/hub"
)

// inbound is a client → server control frame.
type inbound struct {
	Event string `json:"event"`
	Data  struct {
		Kind hub.SubscriptionKind `json:"kind"`
		ID   string               `json:"id"`
	} `json:"data"`
}

// wsSink writes hub messages to a single WebSocket connection. Writes are
// serialized with a mutex because gorilla forbids concurrent writers.
type wsSink struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

// Deliver writes a message frame to the socket; write errors are dropped here
// and surfaced by the read loop's disconnect detection.
func (s *wsSink) Deliver(msg hub.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.conn.WriteJSON(msg)
}

// Handler returns an http.Handler that upgrades requests to WebSocket and binds
// each connection to the hub. The session key is taken from the "session" query
// parameter (falling back to a fresh id), and a dashboard connection joins the
// global room when "dashboard=1" is set.
func Handler(h *hub.Hub) http.HandlerFunc {
	upgrader := websocket.Upgrader{
		// Auth/origin checks are enforced upstream at the gateway.
		CheckOrigin: func(*http.Request) bool { return true },
	}
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		key := r.URL.Query().Get("session")
		if key == "" {
			key = uuid.NewString()
		}
		connID := uuid.NewString()

		client := h.Connect(connID, key, &wsSink{conn: conn})
		if r.URL.Query().Get("dashboard") == "1" {
			h.SubscribeRoom(connID, hub.DashboardRoom)
		}
		_ = client

		defer func() {
			h.Disconnect(connID)
			_ = conn.Close()
		}()

		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return // disconnect detected; resources released via defer
			}
			var in inbound
			if json.Unmarshal(raw, &in) != nil {
				continue
			}
			switch in.Event {
			case hub.EventSubscribe:
				h.Subscribe(connID, in.Data.Kind, in.Data.ID)
			case hub.EventUnsubscribe:
				h.Unsubscribe(connID, in.Data.Kind, in.Data.ID)
			}
		}
	}
}

// StatusHandler exposes a session's connection status for the dashboard
func StatusHandler(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.URL.Query().Get("session")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"session": key,
			"status":  h.Status(key).String(),
		})
	}
}
