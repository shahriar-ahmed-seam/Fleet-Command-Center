package geofence

import (
	"context"
	"log"
	"sort"
)

// Engine evaluates each accepted ping against the zone catalog, diffs the
// result against prior membership, and emits Enter/Exit events on change.
type Engine struct {
	catalog   ZoneCatalog
	members   MembershipStore
	publisher EventPublisher
}

// Option configures an Engine.
type Option func(*Engine)

// WithPublisher attaches a queue publisher for generated events.
func WithPublisher(p EventPublisher) Option {
	return func(e *Engine) { e.publisher = p }
}

// WithMembershipStore overrides the membership store (defaults to in-memory).
func WithMembershipStore(m MembershipStore) Option {
	return func(e *Engine) { e.members = m }
}

// NewEngine builds an Engine over the given catalog. A nil publisher degrades
// to a no-op so evaluation proceeds even with no queue configured, and the
// membership store defaults to in-memory.
func NewEngine(catalog ZoneCatalog, opts ...Option) *Engine {
	e := &Engine{
		catalog:   catalog,
		members:   NewMemoryMembership(),
		publisher: noopPublisher{},
	}
	for _, opt := range opts {
		opt(e)
	}
	if e.publisher == nil {
		e.publisher = noopPublisher{}
	}
	if e.members == nil {
		e.members = NewMemoryMembership()
	}
	return e
}

// OnAcceptedPing evaluates one accepted ping and returns the generated events.
//
// It computes the zones currently containing the ping (boundary inclusive),
// compares against the vehicle's prior membership, and emits an Enter for each
// are published to the queue for the Streaming_Service.
//
// Events are returned (and published) in a deterministic order: sorted by zone
// id, so a ping that simultaneously exits one zone and enters another yields a
// stable sequence.
func (e *Engine) OnAcceptedPing(ctx context.Context, ping AcceptedPing) ([]ZoneEvent, error) {
	containing, err := e.catalog.Containing(ctx, ping.Point())
	if err != nil {
		return nil, err
	}

	current := make(map[string]Zone, len(containing))
	for _, z := range containing {
		current[z.ID] = z
	}
	prior := e.members.InsideZones(ping.VehicleID)

	var events []ZoneEvent

	// Enter: zones containing the point now that the vehicle was not inside.
	for id, z := range current {
		if !prior[id] {
			events = append(events, ZoneEvent{
				VehicleID: ping.VehicleID,
				ZoneID:    id,
				Type:      EventEnter,
				Label:     cloneLabel(z.ArrivalLabel),
				Timestamp: ping.Timestamp,
			})
			e.members.Set(ping.VehicleID, id, true)
		}
	}

	// Exit: zones the vehicle was inside that no longer contain the point.
	for id := range prior {
		if _, still := current[id]; still {
			continue
		}
		var label *string
		if z, ok, lookupErr := e.catalog.Lookup(ctx, id); lookupErr == nil && ok {
			label = cloneLabel(z.ArrivalLabel)
		}
		events = append(events, ZoneEvent{
			VehicleID: ping.VehicleID,
			ZoneID:    id,
			Type:      EventExit,
			Label:     label,
			Timestamp: ping.Timestamp,
		})
		e.members.Set(ping.VehicleID, id, false)
	}

	sort.SliceStable(events, func(i, j int) bool {
		if events[i].ZoneID != events[j].ZoneID {
			return events[i].ZoneID < events[j].ZoneID
		}
		return events[i].Type < events[j].Type
	})

	for _, ev := range events {
		if pubErr := e.publisher.Publish(ctx, ev); pubErr != nil {
			// Best-effort fan-out: a publish failure must not undo the membership
			// update or abort evaluation of the remaining events.
			log.Printf("geofence: publish zone-event vehicle=%s zone=%s type=%s failed: %v",
				ev.VehicleID, ev.ZoneID, ev.Type, pubErr)
		}
	}

	return events, nil
}

// cloneLabel copies an optional label so callers cannot mutate the catalog's
// backing value through the returned event.
func cloneLabel(label *string) *string {
	if label == nil {
		return nil
	}
	v := *label
	return &v
}
