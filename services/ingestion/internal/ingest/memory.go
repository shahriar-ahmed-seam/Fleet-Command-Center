package ingest

import (
	"context"
	"sync"
	"time"
)

// MemoryStore is an in-memory Store used for local runs, unit tests, and
type MemoryStore struct {
	mu    sync.RWMutex
	byID  map[string]StoredPing
	count int
}

// NewMemoryStore creates an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{byID: map[string]StoredPing{}}
}

// Persist stores a copy of the ping keyed by its id.
func (m *MemoryStore) Persist(_ context.Context, p StoredPing) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Copy the telemetry so later mutation of the caller's struct cannot alter
	// the stored record (round-trip integrity).
	if p.Telemetry != nil {
		t := *p.Telemetry
		p.Telemetry = &t
	}
	m.byID[p.ID] = p
	m.count++
	return nil
}

// Get returns a persisted ping by id.
func (m *MemoryStore) Get(id string) (StoredPing, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, ok := m.byID[id]
	return p, ok
}

// Count returns the number of persisted pings.
func (m *MemoryStore) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.count
}

// MemoryHighWaterMark tracks per-vehicle latest accepted timestamps in memory.
// Safe for concurrent use.
type MemoryHighWaterMark struct {
	mu     sync.RWMutex
	latest map[string]time.Time
}

// NewMemoryHighWaterMark creates an empty high-water-mark store.
func NewMemoryHighWaterMark() *MemoryHighWaterMark {
	return &MemoryHighWaterMark{latest: map[string]time.Time{}}
}

// Latest returns the latest accepted timestamp for a vehicle.
func (h *MemoryHighWaterMark) Latest(vehicleID string) (time.Time, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	ts, ok := h.latest[vehicleID]
	return ts, ok
}

// Advance records ts as the vehicle's new high-water mark when it is newer than
// (or equal to) the current mark.
func (h *MemoryHighWaterMark) Advance(vehicleID string, ts time.Time) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if cur, ok := h.latest[vehicleID]; !ok || ts.After(cur) {
		h.latest[vehicleID] = ts
	}
}

// CollectingPublisher records published events in memory.
type CollectingPublisher struct {
	mu     sync.Mutex
	Events []AcceptedPingEvent
}

// Publish appends the event to the collected slice.
func (c *CollectingPublisher) Publish(_ context.Context, e AcceptedPingEvent) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Events = append(c.Events, e)
	return nil
}

// Count returns the number of published events.
func (c *CollectingPublisher) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.Events)
}
