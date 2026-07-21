package model

import "testing"

func TestFingerprintStableAcrossKeyOrder(t *testing.T) {
	a := ListenerSpec{
		SourceType: "kafka",
		Config:     map[string]string{"topic": "t", "group_id": "g", "bootstrap_servers": "b"},
	}
	b := ListenerSpec{
		SourceType: "kafka",
		Config:     map[string]string{"bootstrap_servers": "b", "group_id": "g", "topic": "t"},
	}
	if a.Fingerprint() != b.Fingerprint() {
		t.Fatalf("fingerprint should be independent of map iteration order:\n a=%q\n b=%q", a.Fingerprint(), b.Fingerprint())
	}
}

func TestFingerprintChangesWithConfig(t *testing.T) {
	base := ListenerSpec{SourceType: "kafka", Config: map[string]string{"topic": "t"}}
	changed := ListenerSpec{SourceType: "kafka", Config: map[string]string{"topic": "t2"}}
	if base.Fingerprint() == changed.Fingerprint() {
		t.Fatal("changing a config value must change the fingerprint")
	}
}

func TestFingerprintChangesWithSourceType(t *testing.T) {
	kafka := ListenerSpec{SourceType: "kafka", Config: map[string]string{"x": "1"}}
	mq := ListenerSpec{SourceType: "ibmmq", Config: map[string]string{"x": "1"}}
	if kafka.Fingerprint() == mq.Fingerprint() {
		t.Fatal("changing source_type must change the fingerprint")
	}
}

func TestFingerprintIgnoresListenerAndAgentID(t *testing.T) {
	// The fingerprint drives "does the running consumer need a restart?"; it must
	// depend only on fields that affect the consumer, not on identity fields.
	a := ListenerSpec{ListenerID: "l1", AgentID: "a1", SourceType: "kafka", Config: map[string]string{"topic": "t"}}
	b := ListenerSpec{ListenerID: "l2", AgentID: "a2", SourceType: "kafka", Config: map[string]string{"topic": "t"}}
	if a.Fingerprint() != b.Fingerprint() {
		t.Fatal("fingerprint must ignore listener_id / agent_id")
	}
}
