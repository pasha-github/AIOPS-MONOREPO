// Package api is the control-plane HTTP server the AIOps backend calls to
// start/stop consumers, plus debug endpoints for dead-letters and metrics.
package api

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"

	"listener-service/internal/config"
	"listener-service/internal/model"
	"listener-service/internal/registry"
	"listener-service/internal/store"
)

const serviceSecretHeader = "X-Listener-Service-Secret"

type Server struct {
	cfg   config.Config
	reg   *registry.Registry
	store *store.Store
}

// NewServer wires the routes and returns the handler.
func NewServer(cfg config.Config, reg *registry.Registry, st *store.Store) http.Handler {
	s := &Server{cfg: cfg, reg: reg, store: st}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("POST /listeners", s.auth(s.startListener))
	mux.HandleFunc("DELETE /listeners/{id}", s.auth(s.stopListener))
	mux.HandleFunc("GET /listeners", s.auth(s.listListeners))
	mux.HandleFunc("GET /listeners/{id}/deadletter", s.auth(s.deadLetter))
	mux.HandleFunc("GET /listeners/{id}/metrics", s.auth(s.metrics))
	return mux
}

// auth enforces the shared service secret (fail-closed if unset).
func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provided := r.Header.Get(serviceSecretHeader)
		if s.cfg.ServiceSecret == "" ||
			subtle.ConstantTimeCompare([]byte(provided), []byte(s.cfg.ServiceSecret)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) startListener(w http.ResponseWriter, r *http.Request) {
	var spec model.ListenerSpec
	if err := json.NewDecoder(r.Body).Decode(&spec); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if spec.ListenerID == "" || spec.AgentID == "" || spec.SourceType == "" {
		http.Error(w, "listener_id, agent_id, source_type required", http.StatusBadRequest)
		return
	}
	if err := s.reg.Start(spec); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "active"})
}

func (s *Server) stopListener(w http.ResponseWriter, r *http.Request) {
	s.reg.Stop(r.PathValue("id"))
	writeJSON(w, http.StatusOK, map[string]string{"status": "stopped"})
}

func (s *Server) listListeners(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.reg.List())
}

func (s *Server) deadLetter(w http.ResponseWriter, r *http.Request) {
	recs, err := s.store.ListDeadLetter(r.PathValue("id"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, recs)
}

func (s *Server) metrics(w http.ResponseWriter, r *http.Request) {
	m, err := s.store.Metrics(r.PathValue("id"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
