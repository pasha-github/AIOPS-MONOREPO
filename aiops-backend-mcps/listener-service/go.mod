module listener-service

go 1.25.0

require (
	// mq-golang is only compiled into the `ibmmq`-tagged build (see
	// internal/consumer/ibmmq.go); the default pure-Go build never imports it.
	// Kept as a direct requirement so `go build -tags ibmmq` resolves it — do NOT
	// run `go mod tidy` without `-tags ibmmq`, which would strip this line.
	github.com/ibm-messaging/mq-golang/v5 v5.7.2
	github.com/segmentio/kafka-go v0.4.51
	go.etcd.io/bbolt v1.5.0
)

require (
	github.com/joho/godotenv v1.5.1 // indirect
	github.com/klauspost/compress v1.15.9 // indirect
	github.com/pierrec/lz4/v4 v4.1.15 // indirect
	github.com/xdg-go/pbkdf2 v1.0.0 // indirect
	github.com/xdg-go/scram v1.1.2 // indirect
	github.com/xdg-go/stringprep v1.0.4 // indirect
	golang.org/x/sys v0.45.0 // indirect
	golang.org/x/text v0.23.0 // indirect
)
