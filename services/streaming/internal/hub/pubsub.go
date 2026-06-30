package hub

import (
	"context"
	"sync"
)

// Envelope is a room-addressed message moved across the Pub/Sub layer so a
// message published on one Streaming_Service replica reaches subscribers
// fan-out through Redis Pub/Sub").
type Envelope struct {
	Room    string  `json:"room"`
	Message Message `json:"message"`
}

// PubSub is the cross-replica fan-out transport. Publish sends an envelope to
// every replica (including the sender); Subscribe registers the handler the
// hub uses to deliver envelopes to its local clients.
type PubSub interface {
	// Publish broadcasts an envelope to all replicas.
	Publish(ctx context.Context, env Envelope) error
	// Subscribe registers the handler invoked for every received envelope. It
	// must be called before envelopes can be delivered locally.
	Subscribe(ctx context.Context, handler func(Envelope)) error
	// Close releases any underlying resources.
	Close() error
}

// LocalPubSub is an in-process PubSub used for single-node runs and tests. It
// invokes the registered handler synchronously on Publish, giving tests
// deterministic delivery ordering.
type LocalPubSub struct {
	mu      sync.RWMutex
	handler func(Envelope)
}

// NewLocalPubSub creates an in-process PubSub.
func NewLocalPubSub() *LocalPubSub { return &LocalPubSub{} }

// Subscribe records the delivery handler.
func (l *LocalPubSub) Subscribe(_ context.Context, handler func(Envelope)) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.handler = handler
	return nil
}

// Publish synchronously delivers the envelope to the registered handler.
func (l *LocalPubSub) Publish(_ context.Context, env Envelope) error {
	l.mu.RLock()
	handler := l.handler
	l.mu.RUnlock()
	if handler != nil {
		handler(env)
	}
	return nil
}

// Close is a no-op for the in-process transport.
func (l *LocalPubSub) Close() error { return nil }
