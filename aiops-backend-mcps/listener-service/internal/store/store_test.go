package store

import (
	"path/filepath"
	"testing"

	"listener-service/internal/model"
)

func openTemp(t *testing.T) *Store {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), "listener.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func TestSaveLoadSpecsRoundTrip(t *testing.T) {
	st := openTemp(t)
	specs := []model.ListenerSpec{
		{ListenerID: "l1", AgentID: "a1", SourceType: "kafka", Config: map[string]string{"topic": "t1"}},
		{ListenerID: "l2", AgentID: "a2", SourceType: "ibmmq", Config: map[string]string{"queue_name": "Q"}},
	}
	if err := st.SaveSpecs(specs); err != nil {
		t.Fatalf("SaveSpecs: %v", err)
	}
	got, err := st.LoadSpecs()
	if err != nil {
		t.Fatalf("LoadSpecs: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 specs, got %d", len(got))
	}
	byID := map[string]model.ListenerSpec{}
	for _, s := range got {
		byID[s.ListenerID] = s
	}
	if byID["l1"].Config["topic"] != "t1" || byID["l2"].SourceType != "ibmmq" {
		t.Fatalf("round-trip mismatch: %+v", byID)
	}
}

func TestSaveSpecsReplacesPreviousSet(t *testing.T) {
	st := openTemp(t)
	if err := st.SaveSpecs([]model.ListenerSpec{{ListenerID: "old"}}); err != nil {
		t.Fatal(err)
	}
	if err := st.SaveSpecs([]model.ListenerSpec{{ListenerID: "new"}}); err != nil {
		t.Fatal(err)
	}
	got, err := st.LoadSpecs()
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ListenerID != "new" {
		t.Fatalf("SaveSpecs should replace, not merge; got %+v", got)
	}
}

func TestLoadSpecsEmpty(t *testing.T) {
	st := openTemp(t)
	got, err := st.LoadSpecs()
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("expected no specs, got %d", len(got))
	}
}

func TestDeadLetterIsolatedPerListener(t *testing.T) {
	st := openTemp(t)
	meta := map[string]string{"topic": "t", "offset": "5"}
	if err := st.DeadLetter("l1", "msg-a", meta, "boom"); err != nil {
		t.Fatal(err)
	}
	if err := st.DeadLetter("l1", "msg-b", meta, "boom2"); err != nil {
		t.Fatal(err)
	}
	if err := st.DeadLetter("l2", "other", meta, "err"); err != nil {
		t.Fatal(err)
	}

	l1, err := st.ListDeadLetter("l1")
	if err != nil {
		t.Fatal(err)
	}
	if len(l1) != 2 {
		t.Fatalf("l1 want 2 dead letters, got %d", len(l1))
	}
	if l1[0].Seq != 1 || l1[1].Seq != 2 {
		t.Fatalf("dead-letter seq should auto-increment: %+v", l1)
	}
	if l1[0].Message != "msg-a" || l1[0].Error != "boom" || l1[0].Metadata["offset"] != "5" {
		t.Fatalf("dead-letter record not persisted correctly: %+v", l1[0])
	}

	l2, err := st.ListDeadLetter("l2")
	if err != nil {
		t.Fatal(err)
	}
	if len(l2) != 1 {
		t.Fatalf("l2 want 1 dead letter, got %d", len(l2))
	}
}

func TestListDeadLetterUnknownListener(t *testing.T) {
	st := openTemp(t)
	got, err := st.ListDeadLetter("nope")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("unknown listener should have no dead letters, got %d", len(got))
	}
}

func TestMetricsCounters(t *testing.T) {
	st := openTemp(t)
	for i := 0; i < 3; i++ {
		if err := st.Incr("l1", "received"); err != nil {
			t.Fatal(err)
		}
	}
	if err := st.Incr("l1", "delivered"); err != nil {
		t.Fatal(err)
	}
	if err := st.Incr("l2", "received"); err != nil {
		t.Fatal(err)
	}

	m, err := st.Metrics("l1")
	if err != nil {
		t.Fatal(err)
	}
	if m["received"] != 3 || m["delivered"] != 1 {
		t.Fatalf("l1 metrics wrong: %+v", m)
	}
	if _, ok := m["dead_lettered"]; ok {
		t.Fatalf("l1 should not have unrelated counters: %+v", m)
	}

	m2, err := st.Metrics("l2")
	if err != nil {
		t.Fatal(err)
	}
	if m2["received"] != 1 {
		t.Fatalf("l2 metrics should be isolated from l1: %+v", m2)
	}
}

func TestMetricsUnknownListener(t *testing.T) {
	st := openTemp(t)
	m, err := st.Metrics("nope")
	if err != nil {
		t.Fatal(err)
	}
	if len(m) != 0 {
		t.Fatalf("unknown listener should have no metrics, got %+v", m)
	}
}
