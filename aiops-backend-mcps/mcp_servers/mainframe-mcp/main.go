package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const workflowWaitTimeout = 3 * time.Minute

// workflowName builds a unique workflow instance name from a prefix, the current
// datetime, and a UUID (guaranteeing uniqueness across concurrent runs).
func workflowName(prefix string) string {
	return fmt.Sprintf("%s_%s_%s", prefix, time.Now().Format("20060102_150405"), uuid.NewString())
}

func main() {
	cfg, err := LoadConfig()
	if err != nil {
		log.Fatalf("configuration error: %v", err)
	}

	client := NewClient(cfg.BaseURL, cfg.User, cfg.Password, cfg.System, cfg.Owner)

	s := server.NewMCPServer(
		"mainframe-mcp",
		"1.0.0",
		server.WithToolCapabilities(true),
	)

	registerDatasetInfoTool(s, cfg, client)
	registerReallocateTool(s, cfg, client)

	// Transport selection: "http" serves /mcp (Streamable HTTP) and /sse
	// (legacy SSE) on one port; anything else (default) uses stdio.
	transport := strings.ToLower(getenv("MCP_TRANSPORT", "stdio"))
	switch transport {
	case "http", "sse", "streamable", "streamable-http":
		if err := serveHTTP(s); err != nil {
			log.Fatalf("http server error: %v", err)
		}
	default:
		if err := server.ServeStdio(s); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}
}

// serveHTTP exposes the MCP server over HTTP, mounting both the modern
// Streamable HTTP transport at /mcp and the legacy SSE transport at /sse
// (with its message endpoint at /message) on a single listener.
func serveHTTP(s *server.MCPServer) error {
	addr := getenv("MCP_HTTP_ADDR", ":"+getenv("PORT", "8080"))

	streamable := server.NewStreamableHTTPServer(s,
		server.WithEndpointPath("/mcp"),
		server.WithStateLess(true),
		// Backend service accessed server-to-server; relax DNS-rebinding guard.
		server.WithDisableLocalhostProtection(true),
		// Send periodic heartbeats on the GET notification stream so idle
		// connections aren't dropped by clients/proxies (fixes undici
		// "TypeError: terminated" in Postman and similar clients).
		server.WithHeartbeatInterval(15*time.Second),
	)

	sse := server.NewSSEServer(s,
		server.WithSSEEndpoint("/sse"),
		server.WithMessageEndpoint("/message"),
		server.WithSSEDisableLocalhostProtection(true),
		// Keep the SSE connection alive with periodic pings.
		server.WithKeepAliveInterval(15*time.Second),
	)

	mux := http.NewServeMux()
	mux.Handle("/mcp", streamable)
	mux.Handle("/sse", sse.SSEHandler())
	mux.Handle("/message", sse.MessageHandler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	log.Printf("mainframe-mcp listening on %s (endpoints: /mcp, /sse, /message, /health)", addr)
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	return httpServer.ListenAndServe()
}

// registerDatasetInfoTool implements Workflow1: retrieve full data set
// information (space allocation, DCB attributes, etc.) via a z/OSMF workflow.
func registerDatasetInfoTool(s *server.MCPServer, cfg *Config, client *Client) {
	tool := mcp.NewTool(
		"get_dataset_info",
		mcp.WithDescription(
			"Workflow1: Retrieve full data set information (space allocation, organization, "+
				"record format, extents, etc.) for the data set that hit a space issue. "+
				"Takes no input — the target data set is hardcoded. "+
				"Runs the z/OSMF b37_info_retrieve workflow via LISTDSI and returns the report text.",
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Hardcoded workflow inputs.
		const dsn = "ADCDMST.JCL.DEMO"
		outputFile := cfg.InfoOutputDataset
		notifyUser := cfg.Owner

		vars := []Variable{
			{Name: "dsn", Value: dsn},
			{Name: "outputFile", Value: outputFile},
			{Name: "notifyUser", Value: notifyUser},
		}
		jobStatement := "//DSINFO JOB (ACCT),'DS INFO',CLASS=A,MSGCLASS=X,NOTIFY=" + cfg.Owner
		name := workflowName("DSINFO")

		report, wf, err := runWorkflow(ctx, client, name, cfg.InfoDefinitionFile, jobStatement, vars, outputFile)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		result := fmt.Sprintf(
			"Data set information for %s (workflowKey: %s)\n\n%s",
			dsn, wf.WorkflowKey, report,
		)
		return mcp.NewToolResultText(result), nil
	})
}

// registerReallocateTool implements Workflow2: reallocate / increase the space
// for a data set (typically after a B37 abend) using caller-supplied primary and
// secondary space values.
func registerReallocateTool(s *server.MCPServer, cfg *Config, client *Client) {
	tool := mcp.NewTool(
		"reallocate_dataset",
		mcp.WithDescription(
			"Workflow2: Reallocate/increase the space for a data set that failed with a B37 abend. "+
				"Uses the new primary and secondary space values supplied by the caller (typically after "+
				"reviewing the output of get_dataset_info). Runs the z/OSMF b37_remed workflow and returns "+
				"the reallocation job output (expect IDCAMS condition code 0 on success).",
		),
		mcp.WithString("newPrimary",
			mcp.Required(),
			mcp.Description("New primary space allocation (in CYL), e.g. 100"),
		),
		mcp.WithString("newSecondary",
			mcp.Required(),
			mcp.Description("New secondary space allocation (in CYL), e.g. 50"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		newPrimary, err := req.RequireString("newPrimary")
		if err != nil {
			return mcp.NewToolResultError("newPrimary is required"), nil
		}
		newSecondary, err := req.RequireString("newSecondary")
		if err != nil {
			return mcp.NewToolResultError("newSecondary is required"), nil
		}

		// Hardcoded data set attributes (from the dataset in context).
		const (
			dsn       = "ADCDMST.JCL.DEMO"
			recfm     = "FB"
			lrecl     = "80"
			blksize   = "27920"
			dsorg     = "PO"
			spaceUnit = "CYL"
			dsntype   = "LIBRARY"
		)
		outputFile := cfg.ReallocateOutputDataset
		notifyUser := cfg.Owner

		vars := []Variable{
			{Name: "dsn", Value: dsn},
			{Name: "recfm", Value: recfm},
			{Name: "lrecl", Value: lrecl},
			{Name: "blksize", Value: blksize},
			{Name: "dsorg", Value: dsorg},
			{Name: "spaceUnit", Value: spaceUnit},
			{Name: "newPrimary", Value: newPrimary},
			{Name: "newSecondary", Value: newSecondary},
			{Name: "dsntype", Value: dsntype},
			{Name: "notifyUser", Value: notifyUser},
			{Name: "outputFile", Value: outputFile},
		}
		jobStatement := "//B37FIX JOB (ACCT),'B37 FIX',CLASS=A,MSGCLASS=X,NOTIFY=" + cfg.Owner
		name := workflowName("B37_Reallocate")

		output, wf, err := runWorkflow(ctx, client, name, cfg.ReallocateDefinitionFile, jobStatement, vars, outputFile)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		result := fmt.Sprintf(
			"Reallocated %s to primary=%s secondary=%s %s (workflowKey: %s)\n\n%s",
			dsn, newPrimary, newSecondary, spaceUnit, wf.WorkflowKey, output,
		)
		return mcp.NewToolResultText(result), nil
	})
}

// runWorkflow drives the three-step z/OSMF workflow lifecycle shared by both
// tools: create -> start -> wait for completion -> read the output data set.
func runWorkflow(ctx context.Context, client *Client, name, definitionFile, jobStatement string, vars []Variable, outputFile string) (string, *createWorkflowResponse, error) {
	wf, err := client.CreateWorkflow(ctx, name, definitionFile, jobStatement, vars)
	if err != nil {
		return "", nil, fmt.Errorf("create workflow: %w", err)
	}

	// Best-effort cleanup of the workflow instance once we're done.
	defer func() {
		_ = client.DeleteWorkflow(context.Background(), wf.WorkflowKey)
	}()

	if err := client.StartWorkflow(ctx, wf.WorkflowKey); err != nil {
		return "", wf, fmt.Errorf("start workflow (key %s): %w", wf.WorkflowKey, err)
	}

	// NOTE: WaitForCompletion is intentionally skipped for now — we read the
	// output data set immediately after starting the workflow. The job may not
	// have finished writing yet, so the output can be empty or stale.
	output, err := client.ReadDataset(ctx, outputFile)
	if err != nil {
		return "", wf, fmt.Errorf("read output data set %s: %w", outputFile, err)
	}
	return strings.TrimRight(output, "\n"), wf, nil
}
