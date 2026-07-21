// Package config loads runtime configuration from environment variables.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string        // HTTP port to listen on
	AIOpsBaseURL      string        // e.g. https://agent-manager-dev...run.app
	ServiceSecret     string        // validates inbound control calls (X-Listener-Service-Secret)
	CallbackSecret    string        // sent on callbacks + active-listeners fetch
	BoltDBPath        string        // path to the embedded BoltDB file
	ReconcileInterval time.Duration // how often to reconcile against AIOps
}

// getenv returns the env var trimmed of surrounding whitespace (a stray space in
// a .env line is a common footgun — e.g. a trailing space on AIOPS_BASE_URL
// breaks URL parsing, and one on a secret causes silent 401s), or the fallback.
func getenv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func Load() Config {
	// Load a .env file if present (real environment variables take precedence,
	// matching python-dotenv on the AIOps side). Missing file is not an error.
	_ = godotenv.Load()

	interval := 30
	if v := os.Getenv("RECONCILE_INTERVAL_SECONDS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			interval = n
		}
	}
	return Config{
		Port:              getenv("PORT", "8080"),
		AIOpsBaseURL:      strings.TrimRight(getenv("AIOPS_BASE_URL", ""), "/"),
		ServiceSecret:     getenv("LISTENER_SERVICE_SECRET", ""),
		CallbackSecret:    getenv("LISTENER_CALLBACK_SECRET", ""),
		BoltDBPath:        getenv("BOLT_DB_PATH", "/data/listener.db"),
		ReconcileInterval: time.Duration(interval) * time.Second,
	}
}
