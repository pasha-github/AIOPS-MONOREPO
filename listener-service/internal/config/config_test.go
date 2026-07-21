package config

import (
	"testing"
	"time"
)

func TestLoadReadsAndTrimsEnv(t *testing.T) {
	t.Setenv("PORT", " 9090 ")
	t.Setenv("AIOPS_BASE_URL", "https://aiops.example.com/") // trailing slash trimmed
	t.Setenv("LISTENER_SERVICE_SECRET", " svc ")
	t.Setenv("LISTENER_CALLBACK_SECRET", "cb")
	t.Setenv("BOLT_DB_PATH", "custom.db")
	t.Setenv("RECONCILE_INTERVAL_SECONDS", "15")

	cfg := Load()

	if cfg.Port != "9090" {
		t.Errorf("Port = %q, want 9090 (trimmed)", cfg.Port)
	}
	if cfg.AIOpsBaseURL != "https://aiops.example.com" {
		t.Errorf("AIOpsBaseURL = %q, want trailing slash trimmed", cfg.AIOpsBaseURL)
	}
	if cfg.ServiceSecret != "svc" {
		t.Errorf("ServiceSecret = %q, want svc (trimmed)", cfg.ServiceSecret)
	}
	if cfg.CallbackSecret != "cb" {
		t.Errorf("CallbackSecret = %q, want cb", cfg.CallbackSecret)
	}
	if cfg.BoltDBPath != "custom.db" {
		t.Errorf("BoltDBPath = %q, want custom.db", cfg.BoltDBPath)
	}
	if cfg.ReconcileInterval != 15*time.Second {
		t.Errorf("ReconcileInterval = %v, want 15s", cfg.ReconcileInterval)
	}
}

func TestLoadDefaults(t *testing.T) {
	// Empty values must fall back to defaults (getenv treats blank as unset).
	t.Setenv("PORT", "")
	t.Setenv("BOLT_DB_PATH", "")
	t.Setenv("RECONCILE_INTERVAL_SECONDS", "")

	cfg := Load()

	if cfg.Port != "8080" {
		t.Errorf("Port default = %q, want 8080", cfg.Port)
	}
	if cfg.BoltDBPath != "/data/listener.db" {
		t.Errorf("BoltDBPath default = %q, want /data/listener.db", cfg.BoltDBPath)
	}
	if cfg.ReconcileInterval != 30*time.Second {
		t.Errorf("ReconcileInterval default = %v, want 30s", cfg.ReconcileInterval)
	}
}

func TestLoadInvalidReconcileIntervalFallsBack(t *testing.T) {
	t.Setenv("RECONCILE_INTERVAL_SECONDS", "not-a-number")
	if got := Load().ReconcileInterval; got != 30*time.Second {
		t.Errorf("invalid interval should fall back to 30s, got %v", got)
	}

	t.Setenv("RECONCILE_INTERVAL_SECONDS", "-5")
	if got := Load().ReconcileInterval; got != 30*time.Second {
		t.Errorf("non-positive interval should fall back to 30s, got %v", got)
	}
}
