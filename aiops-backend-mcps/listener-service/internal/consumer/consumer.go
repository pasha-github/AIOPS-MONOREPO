// Package consumer abstracts a message source (Kafka today, IBM MQ later) behind
// a single Run loop that invokes a handler per message.
package consumer

import (
	"context"
	"fmt"

	"listener-service/internal/model"
)

// MessageHandler processes one message. Returning nil means "handled — safe to
// commit/ack"; returning an error means "do not commit" (the message will be
// redelivered), which the registry only does on shutdown.
type MessageHandler func(msg []byte, meta map[string]string) error

// Consumer runs until ctx is cancelled, calling onMessage per message.
type Consumer interface {
	Run(ctx context.Context, onMessage MessageHandler) error
}

// New builds a consumer for the spec's source type.
func New(spec model.ListenerSpec) (Consumer, error) {
	switch spec.SourceType {
	case "kafka":
		return newKafkaConsumer(spec)
	case "ibmmq":
		// Real implementation lives in ibmmq.go (built with `-tags ibmmq`); the
		// default build uses the stub in ibmmq_stub.go which returns an error.
		return newIbmmqConsumer(spec)
	default:
		return nil, fmt.Errorf("unknown source_type %q", spec.SourceType)
	}
}
