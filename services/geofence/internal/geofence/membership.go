package geofence

import "sync"

// MembershipStore holds the prior per-vehicle/zone membership the engine
// compares against to decide Enter/Exit/no-event (the Vehicle_Zone_Membership
// implementation backs local runs and property tests.
type MembershipStore interface {
	// InsideZones returns the set of zone ids the vehicle is currently recorded
	// as inside. The returned map is owned by the caller.
	InsideZones(vehicleID string) map[string]bool
	// Set records whether the vehicle is inside the zone.
	Set(vehicleID, zoneID string, inside bool)
}

// MemoryMembership is an in-memory MembershipStore. Safe for concurrent use.
type MemoryMembership struct {
	mu     sync.RWMutex
	inside map[string]map[string]bool // vehicleID -> zoneID -> inside
}

// NewMemoryMembership creates an empty membership store.
func NewMemoryMembership() *MemoryMembership {
	return &MemoryMembership{inside: map[string]map[string]bool{}}
}

// InsideZones returns a copy of the zone set the vehicle is inside.
func (m *MemoryMembership) InsideZones(vehicleID string) map[string]bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := map[string]bool{}
	for zoneID, inside := range m.inside[vehicleID] {
		if inside {
			out[zoneID] = true
		}
	}
	return out
}

// Set records the vehicle's membership for a zone.
func (m *MemoryMembership) Set(vehicleID, zoneID string, inside bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	zones := m.inside[vehicleID]
	if zones == nil {
		zones = map[string]bool{}
		m.inside[vehicleID] = zones
	}
	zones[zoneID] = inside
}
