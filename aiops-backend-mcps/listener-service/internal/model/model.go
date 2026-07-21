// Package model holds the shared domain types exchanged between AIOps and this
// service and persisted in the local store.
package model

import (
	"sort"
	"strings"
)

// ListenerSpec is one listener as served by the AIOps `/agent/listeners/active`
// endpoint and accepted by the control API. Config values are already decrypted
// by AIOps before they reach this service.
type ListenerSpec struct {
	ListenerID string            `json:"listener_id"`
	AgentID    string            `json:"agent_id"`
	SourceType string            `json:"source_type"`
	Config     map[string]string `json:"config"`
}

// Fingerprint is a stable string derived from the fields that affect the running
// consumer. The reconcile loop uses it to decide whether a listener must be
// restarted (config changed) or left alone.
func (s ListenerSpec) Fingerprint() string {
	keys := make([]string, 0, len(s.Config))
	for k := range s.Config {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	b.WriteString(s.SourceType)
	for _, k := range keys {
		b.WriteString("|")
		b.WriteString(k)
		b.WriteString("=")
		b.WriteString(s.Config[k])
	}
	return b.String()
}

// DeadLetterRecord is a message that could not be delivered to AIOps after all
// retries, stored locally for inspection/replay.
type DeadLetterRecord struct {
	Seq      uint64            `json:"seq"`
	Message  string            `json:"message"`
	Metadata map[string]string `json:"metadata"`
	Error    string            `json:"error"`
}
