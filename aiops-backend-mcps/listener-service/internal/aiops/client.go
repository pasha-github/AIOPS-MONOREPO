// Package aiops is the HTTP client for calling back into the AIOps backend: the
// per-message invoke callback and the active-listeners config fetch used by the
// reconcile loop.
package aiops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"listener-service/internal/model"
)

const callbackHeader = "X-Listener-Callback-Secret"

type Client struct {
	baseURL string
	secret  string
	hc      *http.Client
}

func New(baseURL, secret string) *Client {
	return &Client{
		baseURL: baseURL,
		secret:  secret,
		hc:      &http.Client{Timeout: 30 * time.Second},
	}
}

type invokeBody struct {
	Message  string            `json:"message"`
	Metadata map[string]string `json:"metadata"`
}

// Invoke posts one consumed message to the AIOps invoke callback. Success is any
// 2xx response.
func (c *Client) Invoke(ctx context.Context, agentID, listenerID string, msg []byte, meta map[string]string) error {
	if c.baseURL == "" {
		return fmt.Errorf("AIOPS_BASE_URL not set")
	}
	url := fmt.Sprintf("%s/agent/%s/listener/invoke/%s", c.baseURL, agentID, listenerID)
	body, err := json.Marshal(invokeBody{Message: string(msg), Metadata: meta})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(callbackHeader, c.secret)

	resp, err := c.hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("invoke callback returned %d", resp.StatusCode)
	}
	return nil
}

// FetchActive returns every enabled listener (whose agent is enabled) with
// decrypted config, for the reconcile loop.
func (c *Client) FetchActive(ctx context.Context) ([]model.ListenerSpec, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("AIOPS_BASE_URL not set")
	}
	url := c.baseURL + "/agent/listeners/active"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set(callbackHeader, c.secret)

	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("active-listeners returned %d: %s", resp.StatusCode, string(b))
	}
	var specs []model.ListenerSpec
	if err := json.NewDecoder(resp.Body).Decode(&specs); err != nil {
		return nil, err
	}
	return specs, nil
}
