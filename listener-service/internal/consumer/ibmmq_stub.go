//go:build !ibmmq

package consumer

import (
	"fmt"

	"listener-service/internal/model"
)

// newIbmmqConsumer is the placeholder used by the default pure-Go build. The
// real implementation (ibmmq.go) is compiled only under the `ibmmq` build tag,
// because it needs cgo + the IBM MQ C client libraries. A listener with
// source_type "ibmmq" therefore fails fast with a clear message unless the
// service was built with `-tags ibmmq` (see Dockerfile.ibmmq).
func newIbmmqConsumer(_ model.ListenerSpec) (Consumer, error) {
	return nil, fmt.Errorf("ibmmq source not supported: this binary was built without IBM MQ support (rebuild with `-tags ibmmq`)")
}
