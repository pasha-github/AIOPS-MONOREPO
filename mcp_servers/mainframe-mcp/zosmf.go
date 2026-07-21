package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Variable is a single z/OSMF workflow variable (name/value pair).
type Variable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Client talks to the z/OSMF REST API on a mainframe LPAR.
type Client struct {
	baseURL  string
	user     string
	password string
	system   string
	owner    string
	http     *http.Client
}

// NewClient builds a z/OSMF client. TLS verification is disabled to mirror the
// `curl -k` usage against LPARs that present self-signed certificates.
func NewClient(baseURL, user, password, system, owner string) *Client {
	return &Client{
		baseURL:  strings.TrimRight(baseURL, "/"),
		user:     user,
		password: password,
		system:   system,
		owner:    owner,
		http: &http.Client{
			Timeout: 60 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		},
	}
}

// do issues an authenticated z/OSMF request with the required CSRF header.
func (c *Client) do(ctx context.Context, method, url string, body []byte) ([]byte, int, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return nil, 0, err
	}
	req.SetBasicAuth(c.user, c.password)
	req.Header.Set("X-CSRF-ZOSMF-HEADER", "zosmf")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return data, resp.StatusCode, nil
}

// createWorkflowResponse captures the fields we need from a workflow creation.
type createWorkflowResponse struct {
	WorkflowKey         string `json:"workflowKey"`
	WorkflowVersion     string `json:"workflowVersion"`
	WorkflowDescription string `json:"workflowDescription"`
	WorkflowID          string `json:"workflowID"`
}

// CreateWorkflow registers a workflow instance and returns its workflow key.
func (c *Client) CreateWorkflow(ctx context.Context, name, definitionFile, jobStatement string, vars []Variable) (*createWorkflowResponse, error) {
	payload := map[string]any{
		"workflowName":           name,
		"workflowDefinitionFile": definitionFile,
		"system":                 c.system,
		"owner":                  c.owner,
		"assignToOwner":          true,
		"jobStatement":           jobStatement,
		"variables":              vars,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	url := c.baseURL + "/zosmf/workflow/rest/1.0/workflows"
	data, status, err := c.do(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("create workflow failed (HTTP %d): %s", status, string(data))
	}

	var out createWorkflowResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("parse create workflow response: %w (body: %s)", err, string(data))
	}
	if out.WorkflowKey == "" {
		return nil, fmt.Errorf("create workflow returned no workflowKey (body: %s)", string(data))
	}
	return &out, nil
}

// StartWorkflow starts execution of a workflow and requests that all subsequent
// steps run automatically.
func (c *Client) StartWorkflow(ctx context.Context, key string) error {
	payload := map[string]any{
		"resolveConflictByUsing": "outputFileValue",
		"performSubsequent":      true,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/zosmf/workflow/rest/1.0/workflows/%s/operations/start", c.baseURL, key)
	data, status, err := c.do(ctx, http.MethodPut, url, body)
	if err != nil {
		return err
	}
	// z/OSMF returns 202 Accepted for a successful start.
	if status < 200 || status >= 300 {
		return fmt.Errorf("start workflow failed (HTTP %d): %s", status, string(data))
	}
	return nil
}

// workflowStatus is a subset of the workflow properties response.
type workflowStatus struct {
	StatusName          string `json:"statusName"`
	AutomationStatus    any    `json:"automationStatus"`
	PercentComplete     any    `json:"percentComplete"`
	WorkflowDescription string `json:"workflowDescription"`
}

// Status fetches the current status of a workflow instance.
func (c *Client) Status(ctx context.Context, key string) (*workflowStatus, error) {
	url := fmt.Sprintf("%s/zosmf/workflow/rest/1.0/workflows/%s", c.baseURL, key)
	data, status, err := c.do(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("get workflow status failed (HTTP %d): %s", status, string(data))
	}
	var out workflowStatus
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("parse workflow status: %w (body: %s)", err, string(data))
	}
	return &out, nil
}

// WaitForCompletion polls the workflow until it reports "complete" or the
// context/timeout elapses.
func (c *Client) WaitForCompletion(ctx context.Context, key string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		st, err := c.Status(ctx, key)
		if err != nil {
			return err
		}
		switch strings.ToLower(st.StatusName) {
		case "complete":
			return nil
		case "in-progress", "automation-in-progress", "started", "":
			// keep polling
		default:
			// Any other status (e.g. an error state) — surface it and stop.
			return fmt.Errorf("workflow ended in status %q", st.StatusName)
		}

		if time.Now().After(deadline) {
			return fmt.Errorf("timed out waiting for workflow to complete (last status: %q)", st.StatusName)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
}

// ReadDataset returns the raw contents of a sequential data set (or PDS member).
func (c *Client) ReadDataset(ctx context.Context, dsname string) (string, error) {
	url := fmt.Sprintf("%s/zosmf/restfiles/ds/%s", c.baseURL, dsname)
	data, status, err := c.do(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	if status < 200 || status >= 300 {
		return "", fmt.Errorf("read dataset %s failed (HTTP %d): %s", dsname, status, string(data))
	}
	return string(data), nil
}

// DeleteWorkflow removes a completed workflow instance. Best-effort cleanup.
func (c *Client) DeleteWorkflow(ctx context.Context, key string) error {
	url := fmt.Sprintf("%s/zosmf/workflow/rest/1.0/workflows/%s", c.baseURL, key)
	data, status, err := c.do(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return fmt.Errorf("delete workflow failed (HTTP %d): %s", status, string(data))
	}
	return nil
}
