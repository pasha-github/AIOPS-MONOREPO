// Package registry owns the lifecycle of running consumers: one goroutine per
// listener with its own cancel func, a per-message handler that retries + dead-
// letters, and a reconcile operation that converges running consumers to a
// desired set.
package registry

import (
	"context"
	"log"
	"sync"
	"time"

	"listener-service/internal/aiops"
	"listener-service/internal/consumer"
	"listener-service/internal/model"
	"listener-service/internal/store"
)

const (
	maxAttempts    = 3
	invokeTimeout  = 30 * time.Second
	baseBackoffSec = 1
)

type entry struct {
	cancel      context.CancelFunc
	fingerprint string
}

type Registry struct {
	mu      sync.Mutex
	running map[string]entry
	store   *store.Store
	aiops   *aiops.Client
}

func New(st *store.Store, ac *aiops.Client) *Registry {
	return &Registry{running: map[string]entry{}, store: st, aiops: ac}
}

// Start begins (or restarts, if config changed) a consumer for spec.
func (r *Registry) Start(spec model.ListenerSpec) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.startLocked(spec)
}

func (r *Registry) startLocked(spec model.ListenerSpec) error {
	if e, ok := r.running[spec.ListenerID]; ok {
		if e.fingerprint == spec.Fingerprint() {
			return nil // already running with the same config
		}
		e.cancel() // config changed — restart
		delete(r.running, spec.ListenerID)
	}

	c, err := consumer.New(spec)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(context.Background())
	r.running[spec.ListenerID] = entry{cancel: cancel, fingerprint: spec.Fingerprint()}

	handler := r.makeHandler(spec)
	go func() {
		log.Printf("listener %s: starting %s consumer", spec.ListenerID, spec.SourceType)
		if err := c.Run(ctx, handler); err != nil && ctx.Err() == nil {
			log.Printf("listener %s: consumer stopped with error: %v", spec.ListenerID, err)
		}
		log.Printf("listener %s: consumer stopped", spec.ListenerID)
	}()
	return nil
}

// Stop cancels and deregisters a running consumer (no-op if not running).
func (r *Registry) Stop(listenerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if e, ok := r.running[listenerID]; ok {
		e.cancel()
		delete(r.running, listenerID)
	}
}

// List returns the IDs of currently running consumers.
func (r *Registry) List() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, 0, len(r.running))
	for id := range r.running {
		out = append(out, id)
	}
	return out
}

// Reconcile converges running consumers to the desired set: stop those no longer
// present, start new ones, restart changed ones.
func (r *Registry) Reconcile(specs []model.ListenerSpec) {
	desired := make(map[string]struct{}, len(specs))
	for _, s := range specs {
		desired[s.ListenerID] = struct{}{}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, e := range r.running {
		if _, ok := desired[id]; !ok {
			e.cancel()
			delete(r.running, id)
		}
	}
	for _, s := range specs {
		if err := r.startLocked(s); err != nil {
			log.Printf("reconcile: start %s failed: %v", s.ListenerID, err)
		}
	}
}

func (r *Registry) makeHandler(spec model.ListenerSpec) consumer.MessageHandler {
	return func(msg []byte, meta map[string]string) error {
		_ = r.store.Incr(spec.ListenerID, "received")

		var lastErr error
		for attempt := 0; attempt < maxAttempts; attempt++ {
			ctx, cancel := context.WithTimeout(context.Background(), invokeTimeout)
			err := r.aiops.Invoke(ctx, spec.AgentID, spec.ListenerID, msg, meta)
			cancel()
			if err == nil {
				_ = r.store.Incr(spec.ListenerID, "delivered")
				return nil
			}
			lastErr = err
			time.Sleep(backoff(attempt))
		}

		log.Printf("listener %s: dead-lettering after %d attempts: %v", spec.ListenerID, maxAttempts, lastErr)
		errStr := ""
		if lastErr != nil {
			errStr = lastErr.Error()
		}
		_ = r.store.DeadLetter(spec.ListenerID, string(msg), meta, errStr)
		_ = r.store.Incr(spec.ListenerID, "dead_lettered")
		return nil // commit so the stream is not blocked
	}
}

func backoff(attempt int) time.Duration {
	return time.Duration(baseBackoffSec<<attempt) * time.Second // 1s, 2s, 4s
}
