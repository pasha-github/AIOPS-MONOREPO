package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"listener-service/internal/aiops"
	"listener-service/internal/config"
	"listener-service/internal/registry"
	"listener-service/internal/store"
)

const testSecret = "svc-secret"

func newTestServer(t *testing.T, serviceSecret string) *httptest.Server {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "listener.db"))
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	cfg := config.Config{ServiceSecret: serviceSecret}
	reg := registry.New(st, aiops.New("", ""))
	srv := httptest.NewServer(NewServer(cfg, reg, st))
	t.Cleanup(srv.Close)
	return srv
}

func do(t *testing.T, srv *httptest.Server, method, path, secret string, body []byte) *http.Response {
	t.Helper()
	var rdr *bytes.Reader
	if body == nil {
		rdr = bytes.NewReader(nil)
	} else {
		rdr = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, srv.URL+path, rdr)
	if err != nil {
		t.Fatal(err)
	}
	if secret != "" {
		req.Header.Set(serviceSecretHeader, secret)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

func TestHealthNeedsNoAuth(t *testing.T) {
	srv := newTestServer(t, testSecret)
	resp := do(t, srv, http.MethodGet, "/healthz", "", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("healthz = %d, want 200", resp.StatusCode)
	}
	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" {
		t.Fatalf("healthz body = %+v", body)
	}
}

func TestControlEndpointsRequireSecret(t *testing.T) {
	srv := newTestServer(t, testSecret)
	cases := []struct {
		method, path string
	}{
		{http.MethodPost, "/listeners"},
		{http.MethodGet, "/listeners"},
		{http.MethodDelete, "/listeners/l1"},
		{http.MethodGet, "/listeners/l1/metrics"},
		{http.MethodGet, "/listeners/l1/deadletter"},
	}
	for _, c := range cases {
		if resp := do(t, srv, c.method, c.path, "", nil); resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("%s %s without secret = %d, want 401", c.method, c.path, resp.StatusCode)
		}
		if resp := do(t, srv, c.method, c.path, "wrong", nil); resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("%s %s with wrong secret = %d, want 401", c.method, c.path, resp.StatusCode)
		}
	}
}

func TestAuthFailsClosedWhenSecretUnset(t *testing.T) {
	// With no configured secret the service must reject everything rather than
	// accept an empty header.
	srv := newTestServer(t, "")
	if resp := do(t, srv, http.MethodGet, "/listeners", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("unset secret should fail closed, got %d", resp.StatusCode)
	}
}

func TestStartListenerInvalidBody(t *testing.T) {
	srv := newTestServer(t, testSecret)
	resp := do(t, srv, http.MethodPost, "/listeners", testSecret, []byte("not json"))
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid body = %d, want 400", resp.StatusCode)
	}
}

func TestStartListenerMissingFields(t *testing.T) {
	srv := newTestServer(t, testSecret)
	body, _ := json.Marshal(map[string]string{"listener_id": "l1"}) // no agent_id/source_type
	resp := do(t, srv, http.MethodPost, "/listeners", testSecret, body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing fields = %d, want 400", resp.StatusCode)
	}
}

func TestStartListenerUnknownSourceType(t *testing.T) {
	srv := newTestServer(t, testSecret)
	body, _ := json.Marshal(map[string]any{
		"listener_id": "l1", "agent_id": "a1", "source_type": "rabbitmq",
		"config": map[string]string{},
	})
	resp := do(t, srv, http.MethodPost, "/listeners", testSecret, body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unknown source_type = %d, want 400", resp.StatusCode)
	}
}

func TestListMetricsDeadLetterWithAuth(t *testing.T) {
	srv := newTestServer(t, testSecret)
	for _, path := range []string{"/listeners", "/listeners/l1/metrics", "/listeners/l1/deadletter"} {
		if resp := do(t, srv, http.MethodGet, path, testSecret, nil); resp.StatusCode != http.StatusOK {
			t.Errorf("GET %s with auth = %d, want 200", path, resp.StatusCode)
		}
	}
}

func TestStopListenerIsIdempotent(t *testing.T) {
	srv := newTestServer(t, testSecret)
	resp := do(t, srv, http.MethodDelete, "/listeners/never-started", testSecret, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("stopping unknown listener = %d, want 200 (idempotent)", resp.StatusCode)
	}
}
