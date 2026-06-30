package hub

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// DefaultChannel is the Redis Pub/Sub channel the Streaming_Service fleet uses
// for cross-replica fan-out. Every replica publishes envelopes here and every
// replica subscribes, so a message produced on one node reaches sockets on any
// Pub/Sub").
const DefaultChannel = "fcc:stream"

// RedisPubSub fans envelopes out across Streaming_Service replicas using Redis
// Pub/Sub. The room is carried inside the envelope; each replica filters to its
// locally-subscribed rooms when delivering.
type RedisPubSub struct {
	client  *redis.Client
	channel string
	sub     *redis.PubSub
}

// NewRedisPubSub builds a RedisPubSub on the given client and channel. An empty
// channel falls back to DefaultChannel.
func NewRedisPubSub(client *redis.Client, channel string) *RedisPubSub {
	if channel == "" {
		channel = DefaultChannel
	}
	return &RedisPubSub{client: client, channel: channel}
}

// Publish marshals the envelope and publishes it to the shared channel.
func (r *RedisPubSub) Publish(ctx context.Context, env Envelope) error {
	payload, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}
	return r.client.Publish(ctx, r.channel, payload).Err()
}

// Subscribe opens the Redis subscription and pumps decoded envelopes into the
// handler from a background goroutine until ctx is cancelled or Close is
// called.
func (r *RedisPubSub) Subscribe(ctx context.Context, handler func(Envelope)) error {
	r.sub = r.client.Subscribe(ctx, r.channel)
	// Wait for the subscription to be established so a Publish that races
	// startup is not silently dropped.
	if _, err := r.sub.Receive(ctx); err != nil {
		return fmt.Errorf("subscribe %s: %w", r.channel, err)
	}
	ch := r.sub.Channel()
	go func() {
		for msg := range ch {
			var env Envelope
			if err := json.Unmarshal([]byte(msg.Payload), &env); err != nil {
				continue // skip malformed messages rather than crash the pump
			}
			handler(env)
		}
	}()
	return nil
}

// Close tears down the subscription.
func (r *RedisPubSub) Close() error {
	if r.sub != nil {
		return r.sub.Close()
	}
	return nil
}
