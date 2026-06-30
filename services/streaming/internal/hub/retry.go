package hub

import (
	"context"
	"sync"
)

// MaxZoneEventRetries bounds the number of redelivery attempts the
// Streaming_Service makes for a zone event that fails its initial delivery.
const MaxZoneEventRetries = 3

// ZoneEventSender attempts to deliver a single zone event, reporting true when
// the delivery succeeds. The streaming transport implements it by broadcasting
// to the dashboard room (see HubZoneEventSender); tests implement it to
// simulate a run of consecutive delivery failures.
type ZoneEventSender func(ZoneEventMessage) bool

// pendingZoneEvent is a retained, undelivered zone event together with the
// number of redelivery attempts already made for it.
type pendingZoneEvent struct {
	event   ZoneEventMessage
	retries int
}

// ZoneEventDelivery retains zone events that fail delivery and retries them up
// through an injectable ZoneEventSender so the same logic backs the live
// broadcast path in production and deterministic failure runs in tests. It is
// safe for concurrent use.
type ZoneEventDelivery struct {
	mu      sync.Mutex
	send    ZoneEventSender
	pending []*pendingZoneEvent
}

// NewZoneEventDelivery creates a retry-backed zone-event deliverer using send
// as the underlying delivery attempt.
func NewZoneEventDelivery(send ZoneEventSender) *ZoneEventDelivery {
	return &ZoneEventDelivery{send: send}
}

// Deliver makes the initial delivery attempt for a zone event. When the attempt
// initial attempt succeeded; a failed attempt leaves the event pending with no
// retries recorded yet.
func (d *ZoneEventDelivery) Deliver(event ZoneEventMessage) bool {
	if d.send(event) {
		return true
	}
	d.mu.Lock()
	d.pending = append(d.pending, &pendingZoneEvent{event: event})
	d.mu.Unlock()
	return false
}

// Retry performs one additional delivery attempt for every retained event. A
// successful attempt drops the event from the queue; a failed attempt increments
// the event's retry count and, once it reaches MaxZoneEventRetries, the event is
// given up and dropped so the total number of retries never exceeds three
func (d *ZoneEventDelivery) Retry() int {
	d.mu.Lock()
	batch := d.pending
	d.pending = nil
	d.mu.Unlock()

	keep := make([]*pendingZoneEvent, 0, len(batch))
	for _, p := range batch {
		if d.send(p.event) {
			continue // delivered on retry; drop from the queue
		}
		p.retries++
		if p.retries < MaxZoneEventRetries {
			keep = append(keep, p) // still within the retry budget
		}
		// otherwise the retry budget is exhausted: give up and drop the event
	}

	d.mu.Lock()
	d.pending = append(keep, d.pending...)
	n := len(d.pending)
	d.mu.Unlock()
	return n
}

// DeliverWithRetries attempts an initial delivery and, on failure, retries
// synchronously up to MaxZoneEventRetries times, stopping early on success. It
// returns the number of retries performed (beyond the initial attempt) and
// whether the event was ultimately delivered. For a sender that fails its first
// K consecutive attempts, the number of retries performed is min(K, 3) and never
func (d *ZoneEventDelivery) DeliverWithRetries(event ZoneEventMessage) (retries int, delivered bool) {
	if d.send(event) {
		return 0, true
	}
	for retries < MaxZoneEventRetries {
		retries++
		if d.send(event) {
			return retries, true
		}
	}
	return retries, false
}

// Pending returns the number of retained, undelivered zone events.
func (d *ZoneEventDelivery) Pending() int {
	d.mu.Lock()
	defer d.mu.Unlock()
	return len(d.pending)
}

// HubZoneEventSender returns a ZoneEventSender that broadcasts a zone event to
// the given room on the hub and treats the delivery as successful only when at
// least one client is connected to receive it and the broadcast itself
// succeeds. When no subscriber is present or the broadcast fails, the event is
func HubZoneEventSender(ctx context.Context, h *Hub, room string) ZoneEventSender {
	return func(z ZoneEventMessage) bool {
		if h.RoomSize(room) == 0 {
			return false
		}
		msg, err := ZoneEvent(z)
		if err != nil {
			return false
		}
		if err := h.Broadcast(ctx, room, msg); err != nil {
			return false
		}
		return true
	}
}
