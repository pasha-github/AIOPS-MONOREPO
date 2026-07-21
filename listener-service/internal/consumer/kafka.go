package consumer

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl"
	"github.com/segmentio/kafka-go/sasl/plain"
	"github.com/segmentio/kafka-go/sasl/scram"

	"listener-service/internal/model"
)

type kafkaConsumer struct {
	reader *kafka.Reader
}

func newKafkaConsumer(spec model.ListenerSpec) (*kafkaConsumer, error) {
	cfg := spec.Config
	brokers := splitAndTrim(cfg["bootstrap_servers"])
	if len(brokers) == 0 {
		return nil, fmt.Errorf("kafka: bootstrap_servers required")
	}
	if cfg["topic"] == "" {
		return nil, fmt.Errorf("kafka: topic required")
	}

	dialer := &kafka.Dialer{Timeout: 10 * time.Second, DualStack: true}
	proto := strings.ToUpper(cfg["security_protocol"])
	if strings.Contains(proto, "SASL") {
		mech, err := saslMechanism(cfg)
		if err != nil {
			return nil, err
		}
		dialer.SASLMechanism = mech
	}
	if strings.Contains(proto, "SSL") {
		dialer.TLS = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		Topic:    cfg["topic"],
		GroupID:  groupID(cfg),
		Dialer:   dialer,
		MinBytes: 1,
		MaxBytes: 10e6,
	})
	return &kafkaConsumer{reader: reader}, nil
}

func (k *kafkaConsumer) Run(ctx context.Context, onMessage MessageHandler) error {
	defer k.reader.Close()
	for {
		m, err := k.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			log.Printf("kafka fetch error: %v", err)
			time.Sleep(time.Second)
			continue
		}

		meta := map[string]string{
			"topic":     m.Topic,
			"partition": strconv.Itoa(m.Partition),
			"offset":    strconv.FormatInt(m.Offset, 10),
			"key":       string(m.Key),
		}

		// At-least-once: commit only after the handler reports success. The
		// handler itself retries + dead-letters, so a non-nil error here means
		// "do not commit" (shutdown), leaving the message for redelivery.
		if err := onMessage(m.Value, meta); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			log.Printf("kafka handler error (will redeliver): %v", err)
			continue
		}
		if err := k.reader.CommitMessages(ctx, m); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			log.Printf("kafka commit error: %v", err)
		}
	}
}

func saslMechanism(cfg map[string]string) (sasl.Mechanism, error) {
	user := cfg["sasl_username"]
	pass := cfg["sasl_password"]
	switch strings.ToUpper(cfg["sasl_mechanism"]) {
	case "", "PLAIN":
		return plain.Mechanism{Username: user, Password: pass}, nil
	case "SCRAM-SHA-256":
		return scram.Mechanism(scram.SHA256, user, pass)
	case "SCRAM-SHA-512":
		return scram.Mechanism(scram.SHA512, user, pass)
	default:
		return nil, fmt.Errorf("unsupported sasl_mechanism %q", cfg["sasl_mechanism"])
	}
}

func groupID(cfg map[string]string) string {
	if g := cfg["group_id"]; g != "" {
		return g
	}
	return "aiops-listener"
}

func splitAndTrim(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
