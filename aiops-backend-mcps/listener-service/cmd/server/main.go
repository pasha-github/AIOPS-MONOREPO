// Command server runs the Kafka/MQ listener microservice: it resumes cached
// consumers on boot, reconciles against AIOps on a loop, and serves the control
// API used by the AIOps backend.
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"listener-service/internal/aiops"
	"listener-service/internal/api"
	"listener-service/internal/config"
	"listener-service/internal/registry"
	"listener-service/internal/store"
)

func main() {
	cfg := config.Load()

	st, err := store.Open(cfg.BoltDBPath)
	if err != nil {
		log.Fatalf("open store %q: %v", cfg.BoltDBPath, err)
	}
	defer st.Close()

	ac := aiops.New(cfg.AIOpsBaseURL, cfg.CallbackSecret)
	reg := registry.New(st, ac)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Resume from the local cache immediately — works even if AIOps is down.
	if cached, err := st.LoadSpecs(); err != nil {
		log.Printf("load cache: %v", err)
	} else {
		log.Printf("resuming %d listeners from cache", len(cached))
		for _, spec := range cached {
			if err := reg.Start(spec); err != nil {
				log.Printf("resume %s: %v", spec.ListenerID, err)
			}
		}
	}

	// Reconcile against AIOps (immediately, then on an interval).
	go reconcileLoop(ctx, reg, ac, st, cfg.ReconcileInterval)

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: api.NewServer(cfg, reg, st)}
	go func() {
		log.Printf("listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server: %v", err)
		}
	}()

	<-ctx.Done()
	log.Printf("shutting down...")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutCtx)
}

func reconcileLoop(
	ctx context.Context,
	reg *registry.Registry,
	ac *aiops.Client,
	st *store.Store,
	interval time.Duration,
) {
	reconcileOnce(ctx, reg, ac, st)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			reconcileOnce(ctx, reg, ac, st)
		}
	}
}

func reconcileOnce(ctx context.Context, reg *registry.Registry, ac *aiops.Client, st *store.Store) {
	rctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	specs, err := ac.FetchActive(rctx)
	if err != nil {
		log.Printf("reconcile: fetch active failed (keeping current consumers): %v", err)
		return
	}
	reg.Reconcile(specs)
	if err := st.SaveSpecs(specs); err != nil {
		log.Printf("reconcile: save cache: %v", err)
	}
	log.Printf("reconcile: %d active listeners", len(specs))
}
