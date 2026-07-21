# syntax=docker/dockerfile:1
#
# Listener service image — supports BOTH Kafka and IBM MQ.
#
# Kafka (kafka-go) is pure Go, but the IBM MQ consumer needs cgo + the IBM MQ C
# client libraries at build and runtime. So this image builds with cgo enabled
# and `-tags ibmmq`, on a glibc base with the MQ client baked in. The resulting
# binary handles both source types.
#
# (For a Kafka-only local build with no C toolchain, just run
#  `CGO_ENABLED=0 go build ./cmd/server` — the ibmmq_stub.go build-tag fallback
#  makes that compile without the MQ libraries.)

# ── Build ────────────────────────────────────────────────────────────────
FROM golang:1.25-bookworm AS build

# IBM MQ redistributable client. The redistributable package is pre-licensed for
# runtime redistribution, so a plain untar into /opt/mqm is all that is required
# (no genmqpkg / license prompt). Override MQ_URL to pin a different level.
ARG MQ_URL=https://public.dhe.ibm.com/ibmdl/export/pub/software/websphere/messaging/mqdev/redist/9.4.1.0-IBM-MQC-Redist-LinuxX64.tar.gz
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/mqm \
    && curl -fsSL "$MQ_URL" -o /tmp/mqclient.tar.gz \
    && tar -zxf /tmp/mqclient.tar.gz -C /opt/mqm \
    && rm -f /tmp/mqclient.tar.gz

# The mq-golang cgo directives default to -I/opt/mqm/inc and -L/opt/mqm/lib64.
ENV MQ_INSTALLATION_PATH=/opt/mqm

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# cgo + `-tags ibmmq` → a binary that supports both Kafka and IBM MQ.
RUN CGO_ENABLED=1 GOOS=linux go build -tags ibmmq -trimpath -ldflags="-s -w" \
    -o /out/listener-service ./cmd/server

# ── Runtime ──────────────────────────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# MQ client runtime libraries (libmqic_r.so and friends).
COPY --from=build /opt/mqm /opt/mqm
ENV LD_LIBRARY_PATH=/opt/mqm/lib64

COPY --from=build /out/listener-service /listener-service
# BoltDB file lives here; mount a persistent/volume-backed path in production.
VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["/listener-service"]
