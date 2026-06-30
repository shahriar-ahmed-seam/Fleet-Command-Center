package hub

import (
	"context"
	"sync"
)

// Sink delivers a message to a single connected client. The WebSocket
// transport implements it by writing to the socket; tests implement it by
// collecting messages. Implementations must be safe for concurrent use.
type Sink interface {
	Deliver(Message)
}

// ConnectionStatus is the live/!live signal the hub surfaces per client
type ConnectionStatus int

const (
	// StatusDisconnected is the zero value: no live connection for the session.
	StatusDisconnected ConnectionStatus = iota
	// StatusConnected indicates a live connection for the session.
	StatusConnected
)

func (s ConnectionStatus) String() string {
	if s == StatusConnected {
		return "connected"
	}
	return "disconnected"
}

// Client is a registered connection. ConnID identifies the physical
// connection; Key identifies the logical session used to resume subscriptions
type Client struct {
	ConnID string
	Key    string
	sink   Sink
	rooms  map[string]bool
}

// Rooms returns a snapshot of the rooms the client is currently joined to.
func (c *Client) Rooms() []string {
	out := make([]string, 0, len(c.rooms))
	for r := range c.rooms {
		out = append(out, r)
	}
	return out
}

// Hub maintains room membership, session subscriptions, and connection status,
// and fans broadcasts out through a PubSub so they reach clients on any
// replica.
type Hub struct {
	mu       sync.RWMutex
	pubsub   PubSub
	clients  map[string]*Client          // connID -> client
	rooms    map[string]map[string]*Client // room -> connID -> client
	sessions map[string]map[string]bool    // session key -> persisted room set
	status   map[string]ConnectionStatus   // session key -> status

	statusListeners []func(key string, status ConnectionStatus)
}

// New creates a Hub backed by the given PubSub.
func New(pubsub PubSub) *Hub {
	return &Hub{
		pubsub:   pubsub,
		clients:  map[string]*Client{},
		rooms:    map[string]map[string]*Client{},
		sessions: map[string]map[string]bool{},
		status:   map[string]ConnectionStatus{},
	}
}

// Start wires the hub to the PubSub so received envelopes are delivered to
// local clients. It must be called once before broadcasting.
func (h *Hub) Start(ctx context.Context) error {
	return h.pubsub.Subscribe(ctx, h.deliverLocal)
}

// OnStatusChange registers a listener invoked whenever a session's connection
// status changes, so the transport can surface the connection-status signal
func (h *Hub) OnStatusChange(fn func(key string, status ConnectionStatus)) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.statusListeners = append(h.statusListeners, fn)
}

// Connect registers a connection for a session and resumes the session's prior
// session was subscribed to before it dropped.
func (h *Hub) Connect(connID, key string, sink Sink) *Client {
	h.mu.Lock()
	c := &Client{ConnID: connID, Key: key, sink: sink, rooms: map[string]bool{}}
	h.clients[connID] = c

	prior, resumed := h.sessions[key]
	if !resumed {
		prior = map[string]bool{}
		h.sessions[key] = prior
	}
	// Resume prior room subscriptions for this session.
	for room := range prior {
		h.joinLocked(c, room)
	}
	h.setStatusLocked(key, StatusConnected)
	h.mu.Unlock()
	return c
}

// Subscribe joins the connection's session to a resource room and persists the
// unknown connection or unrecognized kind.
func (h *Hub) Subscribe(connID string, kind SubscriptionKind, id string) {
	room, ok := RoomFor(kind, id)
	if !ok {
		return
	}
	h.SubscribeRoom(connID, room)
}

// SubscribeRoom joins the connection to an explicit room (e.g. DashboardRoom).
func (h *Hub) SubscribeRoom(connID, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c, ok := h.clients[connID]; ok {
		h.joinLocked(c, room)
	}
}

// Unsubscribe removes the connection's session from a resource room and forgets
// the persisted subscription so it is not resumed later.
func (h *Hub) Unsubscribe(connID string, kind SubscriptionKind, id string) {
	room, ok := RoomFor(kind, id)
	if !ok {
		return
	}
	h.UnsubscribeRoom(connID, room)
}

// UnsubscribeRoom removes the connection from an explicit room.
func (h *Hub) UnsubscribeRoom(connID, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.clients[connID]
	if !ok {
		return
	}
	h.leaveLocked(c, room)
	if sess, ok := h.sessions[c.Key]; ok {
		delete(sess, room)
	}
}

// retaining the session's persisted subscriptions for resume on reconnect
func (h *Hub) Disconnect(connID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.clients[connID]
	if !ok {
		return
	}
	for room := range c.rooms {
		h.removeFromRoomLocked(room, connID)
	}
	delete(h.clients, connID)
	h.setStatusLocked(c.Key, StatusDisconnected)
}

func (h *Hub) Broadcast(ctx context.Context, room string, msg Message) error {
	return h.pubsub.Publish(ctx, Envelope{Room: room, Message: msg})
}

func (h *Hub) Status(key string) ConnectionStatus {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.status[key]
}

// SessionSubscriptions returns a snapshot of the rooms persisted for a session,
// i.e. the set that would be resumed on reconnect.
func (h *Hub) SessionSubscriptions(key string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	sess := h.sessions[key]
	out := make([]string, 0, len(sess))
	for room := range sess {
		out = append(out, room)
	}
	return out
}

// RoomSize returns the number of live connections currently in a room.
func (h *Hub) RoomSize(room string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.rooms[room])
}

// deliverLocal fans an envelope received from the PubSub out to the local
// connections in the target room. Clients only receive messages for rooms they
func (h *Hub) deliverLocal(env Envelope) {
	h.mu.RLock()
	members := h.rooms[env.Room]
	targets := make([]*Client, 0, len(members))
	for _, c := range members {
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	for _, c := range targets {
		c.sink.Deliver(env.Message)
	}
}

// joinLocked adds a client to a room, records it on the client, and persists
// the subscription on the session. Caller holds the write lock.
func (h *Hub) joinLocked(c *Client, room string) {
	if h.rooms[room] == nil {
		h.rooms[room] = map[string]*Client{}
	}
	h.rooms[room][c.ConnID] = c
	c.rooms[room] = true
	if sess, ok := h.sessions[c.Key]; ok {
		sess[room] = true
	} else {
		h.sessions[c.Key] = map[string]bool{room: true}
	}
}

// leaveLocked removes a client from a room and clears it on the client. Caller
// holds the write lock. It does not touch the persisted session set.
func (h *Hub) leaveLocked(c *Client, room string) {
	h.removeFromRoomLocked(room, c.ConnID)
	delete(c.rooms, room)
}

// removeFromRoomLocked removes a connection from a room's member map, dropping
// the empty room. Caller holds the write lock.
func (h *Hub) removeFromRoomLocked(room, connID string) {
	members := h.rooms[room]
	if members == nil {
		return
	}
	delete(members, connID)
	if len(members) == 0 {
		delete(h.rooms, room)
	}
}

// setStatusLocked updates a session's status and notifies listeners on change.
// Caller holds the write lock.
func (h *Hub) setStatusLocked(key string, status ConnectionStatus) {
	if h.status[key] == status {
		return
	}
	h.status[key] = status
	for _, fn := range h.statusListeners {
		fn(key, status)
	}
}
