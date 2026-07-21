//go:build ibmmq

// Package consumer — IBM MQ implementation.
//
// This file is compiled ONLY when the `ibmmq` build tag is set, because the
// underlying github.com/ibm-messaging/mq-golang/v5/ibmmq package requires cgo
// and the IBM MQ C client libraries at build and runtime. The default pure-Go
// build (Kafka only) uses ibmmq_stub.go instead. See Dockerfile.ibmmq.
package consumer

import (
	"context"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/ibm-messaging/mq-golang/v5/ibmmq"

	"listener-service/internal/model"
)

const (
	// How long a single MQGET blocks before returning control so the loop can
	// re-check ctx for cancellation. Kept short for responsive shutdown.
	mqGetWaitMillis = 2000
	// Initial receive buffer; grown automatically if a message is truncated.
	mqInitialBufSize = 1 << 20 // 1 MiB
)

type ibmmqConsumer struct {
	qMgrName   string
	channel    string
	connName   string // "host(port)" (or comma-separated list for multi-instance)
	user       string
	password   string
	queueName  string
	cipherSpec string // optional: TLS CipherSpec (enables client-side TLS)
	keyRepo    string // optional: TLS key repository stem (no .kdb suffix)
	bufSize    int
}

func newIbmmqConsumer(spec model.ListenerSpec) (Consumer, error) {
	cfg := spec.Config
	qmgr := cfg["queue_manager"]
	channel := cfg["channel"]
	queue := cfg["queue_name"]
	switch {
	case qmgr == "":
		return nil, fmt.Errorf("ibmmq: queue_manager required")
	case channel == "":
		return nil, fmt.Errorf("ibmmq: channel required")
	case queue == "":
		return nil, fmt.Errorf("ibmmq: queue_name required")
	}

	connName, err := buildConnName(cfg["host"], cfg["port"])
	if err != nil {
		return nil, err
	}

	return &ibmmqConsumer{
		qMgrName:   qmgr,
		channel:    channel,
		connName:   connName,
		user:       cfg["username"],
		password:   cfg["password"],
		queueName:  queue,
		cipherSpec: cfg["cipher_spec"],
		keyRepo:    cfg["key_repository"],
		bufSize:    mqInitialBufSize,
	}, nil
}

// buildConnName produces an MQ connection name. If host already contains a port
// in "host(port)" form (or is a comma-separated list of such), it is used as-is;
// otherwise host + port are combined, defaulting the port to 1414.
func buildConnName(host, port string) (string, error) {
	host = strings.TrimSpace(host)
	if host == "" {
		return "", fmt.Errorf("ibmmq: host required")
	}
	if strings.Contains(host, "(") {
		return host, nil // already an MQ conn-name list
	}
	if port == "" {
		port = "1414"
	}
	return fmt.Sprintf("%s(%s)", host, port), nil
}

// connect establishes a client connection and opens the queue for input.
func (c *ibmmqConsumer) connect() (ibmmq.MQQueueManager, ibmmq.MQObject, error) {
	var qMgr ibmmq.MQQueueManager
	var qObj ibmmq.MQObject

	cd := ibmmq.NewMQCD()
	cd.ChannelName = c.channel
	cd.ConnectionName = c.connName
	if c.cipherSpec != "" {
		cd.SSLCipherSpec = c.cipherSpec
	}

	cno := ibmmq.NewMQCNO()
	cno.Options = ibmmq.MQCNO_CLIENT_BINDING
	cno.ClientConn = cd

	if c.user != "" {
		csp := ibmmq.NewMQCSP()
		csp.AuthenticationType = ibmmq.MQCSP_AUTH_USER_ID_AND_PWD
		csp.UserId = c.user
		csp.Password = c.password
		cno.SecurityParms = csp
	}

	if c.keyRepo != "" {
		sco := ibmmq.NewMQSCO()
		sco.KeyRepository = c.keyRepo
		cno.SSLConfig = sco
	}

	qMgr, err := ibmmq.Connx(c.qMgrName, cno)
	if err != nil {
		return qMgr, qObj, fmt.Errorf("ibmmq connect qmgr %q: %w", c.qMgrName, err)
	}

	mqod := ibmmq.NewMQOD()
	mqod.ObjectType = ibmmq.MQOT_Q
	mqod.ObjectName = c.queueName
	openOpts := int32(ibmmq.MQOO_INPUT_AS_Q_DEF | ibmmq.MQOO_FAIL_IF_QUIESCING)
	qObj, err = qMgr.Open(mqod, openOpts)
	if err != nil {
		_ = qMgr.Disc()
		return qMgr, qObj, fmt.Errorf("ibmmq open queue %q: %w", c.queueName, err)
	}
	return qMgr, qObj, nil
}

func (c *ibmmqConsumer) Run(ctx context.Context, onMessage MessageHandler) error {
	qMgr, qObj, err := c.connect()
	if err != nil {
		return err
	}
	defer func() {
		_ = qObj.Close(0)
		_ = qMgr.Disc()
	}()

	buffer := make([]byte, c.bufSize)
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		getmqmd := ibmmq.NewMQMD()
		gmo := ibmmq.NewMQGMO()
		// SYNCPOINT so the get is transactional: the message is only removed from
		// the queue when we MQCMIT after a successful callback (at-least-once).
		gmo.Options = ibmmq.MQGMO_SYNCPOINT | ibmmq.MQGMO_WAIT | ibmmq.MQGMO_FAIL_IF_QUIESCING
		gmo.WaitInterval = mqGetWaitMillis

		datalen, err := qObj.Get(getmqmd, gmo, buffer)
		if err != nil {
			mqret, ok := err.(*ibmmq.MQReturn)
			switch {
			case ok && mqret.MQRC == ibmmq.MQRC_NO_MSG_AVAILABLE:
				continue // wait interval elapsed with no message — re-check ctx
			case ok && mqret.MQRC == ibmmq.MQRC_TRUNCATED_MSG_FAILED:
				// Message larger than the buffer; grow to the reported size and
				// retry (under syncpoint the message is still on the queue).
				buffer = make([]byte, datalen)
				continue
			case ctx.Err() != nil:
				return ctx.Err()
			default:
				log.Printf("ibmmq get error: %v", err)
				time.Sleep(time.Second)
				continue
			}
		}

		msg := make([]byte, datalen)
		copy(msg, buffer[:datalen])
		meta := map[string]string{
			"queue_manager": c.qMgrName,
			"queue":         c.queueName,
			"msg_id":        hex.EncodeToString(getmqmd.MsgId),
			"correl_id":     hex.EncodeToString(getmqmd.CorrelId),
			"format":        strings.TrimSpace(getmqmd.Format),
		}

		// At-least-once: commit (removing the message) only after the handler
		// reports success. The handler retries + dead-letters internally, so a
		// non-nil error here means "do not commit" (shutdown) — back out the get
		// so the message is redelivered.
		if err := onMessage(msg, meta); err != nil {
			if backErr := qMgr.Back(); backErr != nil {
				log.Printf("ibmmq backout error: %v", backErr)
			}
			if ctx.Err() != nil {
				return ctx.Err()
			}
			log.Printf("ibmmq handler error (will redeliver): %v", err)
			continue
		}
		if err := qMgr.Cmit(); err != nil {
			log.Printf("ibmmq commit error: %v", err)
		}
	}
}
