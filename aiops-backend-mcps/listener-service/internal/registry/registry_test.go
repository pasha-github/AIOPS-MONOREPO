package registry

import (
	"path/filepath"
	"sort"
	"testing"

	"listener-service/internal/aiops"
	"listener-service/internal/model"
	"listener-service/internal/store"
)

// kafkaSpec builds a valid Kafka listener spec. newKafkaConsumer only constructs
// a reader (no network dial happens until Run), so Start registers it without
// connecting; Stop/Reconcile cancel the goroutine before it does anything.
func kafkaSpec(id, topic string) model.ListenerSpec {
	return model.ListenerSpec{
		ListenerID: id,
		AgentID:    "agent-" + id,
		SourceType: "kafka",
		Config: map[string]string{
			"bootstrap_servers": "127.0.0.1:59092", // unused: never dialed in these tests
			"topic":             topic,
			"group_id":          "g-" + id,
		},
	}
}

func newReg(t *testing.T) *Registry {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "listener.db"))
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return New(st, aiops.New("", ""))
}

func sortedList(r *Registry) []string {
	l := r.List()
	sort.Strings(l)
	return l
}

func TestStartAndStop(t *testing.T) {
	r := newReg(t)
	if len(r.List()) != 0 {
		t.Fatal("new registry should be empty")
	}
	if err := r.Start(kafkaSpec("l1", "t1")); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if got := r.List(); len(got) != 1 || got[0] != "l1" {
		t.Fatalf("after Start, List = %v, want [l1]", got)
	}
	r.Stop("l1")
	if got := r.List(); len(got) != 0 {
		t.Fatalf("after Stop, List = %v, want empty", got)
	}
}

func TestStartUnknownSourceReturnsErrorAndDoesNotRegister(t *testing.T) {
	r := newReg(t)
	err := r.Start(model.ListenerSpec{ListenerID: "bad", SourceType: "rabbitmq"})
	if err == nil {
		t.Fatal("expected error for unknown source type")
	}
	if len(r.List()) != 0 {
		t.Fatal("failed Start must not register a consumer")
	}
}

func TestStartIdempotentSameConfig(t *testing.T) {
	r := newReg(t)
	spec := kafkaSpec("l1", "t1")
	if err := r.Start(spec); err != nil {
		t.Fatal(err)
	}
	if err := r.Start(spec); err != nil { // same fingerprint → no-op restart
		t.Fatal(err)
	}
	if got := r.List(); len(got) != 1 {
		t.Fatalf("re-Start with same config should keep exactly one, got %v", got)
	}
	r.Stop("l1")
}

func TestStartRestartsOnConfigChange(t *testing.T) {
	r := newReg(t)
	if err := r.Start(kafkaSpec("l1", "t1")); err != nil {
		t.Fatal(err)
	}
	if err := r.Start(kafkaSpec("l1", "t2")); err != nil { // changed topic → restart
		t.Fatal(err)
	}
	if got := r.List(); len(got) != 1 || got[0] != "l1" {
		t.Fatalf("after config-change restart, List = %v, want [l1]", got)
	}
	r.Stop("l1")
}

func TestReconcileConverges(t *testing.T) {
	r := newReg(t)
	if err := r.Start(kafkaSpec("a", "ta")); err != nil {
		t.Fatal(err)
	}

	// Desired set drops "a" and adds "b" and "c".
	r.Reconcile([]model.ListenerSpec{kafkaSpec("b", "tb"), kafkaSpec("c", "tc")})
	if got := sortedList(r); len(got) != 2 || got[0] != "b" || got[1] != "c" {
		t.Fatalf("after reconcile, List = %v, want [b c]", got)
	}

	// Empty desired set stops everything.
	r.Reconcile(nil)
	if got := r.List(); len(got) != 0 {
		t.Fatalf("reconcile to empty should stop all, got %v", got)
	}
}
