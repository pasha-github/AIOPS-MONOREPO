# ---- build stage ----
FROM golang:1.26 AS build

WORKDIR /src

# Cache module downloads.
COPY go.mod go.sum ./
RUN go mod download

# Build a statically linked binary.
COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/mainframe-mcp .

# ---- runtime stage ----
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app
COPY --from=build /out/mainframe-mcp /app/mainframe-mcp

# z/OSMF connection settings (override MAINFRAME_BASE_URL at minimum).
ENV MAINFRAME_BASE_URL="https://119.63.131.238:10443" \
    MAINFRAME_USER="ADCDMST" \
    MAINFRAME_SYSTEM="S0W1" \
    MAINFRAME_OWNER="ADCDMST" \
    MCP_TRANSPORT="http" \
    PORT="8080"

# HTTP mode exposes /mcp (Streamable HTTP), /sse + /message (SSE), and /health.
EXPOSE 8080

ENTRYPOINT ["/app/mainframe-mcp"]
