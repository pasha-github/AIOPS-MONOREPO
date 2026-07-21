package aiops

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInvokePostsMessageWithSecret(t *testing.T) {
	var gotPath, gotSecret, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotSecret = r.Header.Get(callbackHeader)
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	c := New(srv.URL, "s3cr3t")
	err := c.Invoke(context.Background(), "agent-1", "listener-9", []byte("hello"),
		map[string]string{"topic": "orders"})
	if err != nil {
		t.Fatalf("Invoke: %v", err)
	}
	if gotPath != "/agent/agent-1/listener/invoke/listener-9" {
		t.Errorf("path = %q", gotPath)
	}
	if gotSecret != "s3cr3t" {
		t.Errorf("callback secret header = %q, want s3cr3t", gotSecret)
	}
	var body invokeBody
	if err := json.Unmarshal([]byte(gotBody), &body); err != nil {
		t.Fatalf("body not valid JSON: %v (%s)", err, gotBody)
	}
	if body.Message != "hello" || body.Metadata["topic"] != "orders" {
		t.Errorf("body = %+v", body)
	}
}

func TestInvokeNon2xxIsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	err := New(srv.URL, "x").Invoke(context.Background(), "a", "l", []byte("m"), nil)
	if err == nil {
		t.Fatal("expected error on 500 response")
	}
}

func TestInvokeNoBaseURL(t *testing.T) {
	if err := New("", "x").Invoke(context.Background(), "a", "l", []byte("m"), nil); err == nil {
		t.Fatal("expected error when AIOPS_BASE_URL is unset")
	}
}

func TestFetchActiveParsesSpecs(t *testing.T) {
	var gotSecret string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotSecret = r.Header.Get(callbackHeader)
		if r.URL.Path != "/agent/listeners/active" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `[{"listener_id":"l1","agent_id":"a1","source_type":"kafka","config":{"topic":"t"}}]`)
	}))
	defer srv.Close()

	specs, err := New(srv.URL, "tok").FetchActive(context.Background())
	if err != nil {
		t.Fatalf("FetchActive: %v", err)
	}
	if gotSecret != "tok" {
		t.Errorf("callback secret header = %q, want tok", gotSecret)
	}
	if len(specs) != 1 || specs[0].ListenerID != "l1" || specs[0].Config["topic"] != "t" {
		t.Fatalf("parsed specs wrong: %+v", specs)
	}
}

func TestFetchActiveNon2xxIsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "nope", http.StatusUnauthorized)
	}))
	defer srv.Close()

	if _, err := New(srv.URL, "x").FetchActive(context.Background()); err == nil {
		t.Fatal("expected error on 401 response")
	}
}

func TestFetchActiveNoBaseURL(t *testing.T) {
	if _, err := New("", "x").FetchActive(context.Background()); err == nil {
		t.Fatal("expected error when AIOPS_BASE_URL is unset")
	}
}
