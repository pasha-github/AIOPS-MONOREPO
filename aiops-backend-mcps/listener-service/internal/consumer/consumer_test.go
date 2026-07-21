//go:build !ibmmq

// These tests exercise the default (Kafka-only) build. The ibmmq case is served
// by ibmmq_stub.go here, so New("ibmmq", ...) is expected to error; the real MQ
// dispatch is covered when built with `-tags ibmmq`.
package consumer

import (
	"strings"
	"testing"

	"listener-service/internal/model"
)

func TestNewUnknownSourceType(t *testing.T) {
	_, err := New(model.ListenerSpec{SourceType: "rabbitmq"})
	if err == nil {
		t.Fatal("expected error for unknown source_type")
	}
	if !strings.Contains(err.Error(), "rabbitmq") {
		t.Errorf("error should name the bad source type, got: %v", err)
	}
}

func TestNewIBMMQStubErrors(t *testing.T) {
	_, err := New(model.ListenerSpec{
		SourceType: "ibmmq",
		Config:     map[string]string{"queue_manager": "QM", "channel": "C", "queue_name": "Q", "host": "h"},
	})
	if err == nil {
		t.Fatal("default build must not support ibmmq")
	}
	if !strings.Contains(err.Error(), "IBM MQ support") {
		t.Errorf("stub error should explain the missing build tag, got: %v", err)
	}
}

func TestNewKafkaRequiresBootstrapServers(t *testing.T) {
	_, err := New(model.ListenerSpec{
		SourceType: "kafka",
		Config:     map[string]string{"topic": "t"},
	})
	if err == nil || !strings.Contains(err.Error(), "bootstrap_servers") {
		t.Fatalf("expected bootstrap_servers error, got: %v", err)
	}
}

func TestNewKafkaRequiresTopic(t *testing.T) {
	_, err := New(model.ListenerSpec{
		SourceType: "kafka",
		Config:     map[string]string{"bootstrap_servers": "localhost:9092"},
	})
	if err == nil || !strings.Contains(err.Error(), "topic") {
		t.Fatalf("expected topic error, got: %v", err)
	}
}

func TestNewKafkaValidConfig(t *testing.T) {
	c, err := New(model.ListenerSpec{
		SourceType: "kafka",
		Config: map[string]string{
			"bootstrap_servers": "localhost:9092",
			"topic":             "orders",
			"group_id":          "g1",
		},
	})
	if err != nil {
		t.Fatalf("valid kafka config should construct a consumer: %v", err)
	}
	if c == nil {
		t.Fatal("consumer should not be nil")
	}
}

func TestNewKafkaUnsupportedSASLMechanism(t *testing.T) {
	_, err := New(model.ListenerSpec{
		SourceType: "kafka",
		Config: map[string]string{
			"bootstrap_servers": "localhost:9092",
			"topic":             "t",
			"security_protocol": "SASL_SSL",
			"sasl_mechanism":    "GSSAPI",
			"sasl_username":     "u",
			"sasl_password":     "p",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "sasl_mechanism") {
		t.Fatalf("expected unsupported sasl_mechanism error, got: %v", err)
	}
}
