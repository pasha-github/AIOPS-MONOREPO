# AIOps Master Demo Guide

This guide provides a comprehensive step-by-step script for demonstrating the full enterprise capabilities of the AIOps platform. It covers everything from autonomous self-healing in a retail application, to live infrastructure mapping, API monitoring, and automated identity management.

## Preparation

Before starting the demo, ensure the entire monorepo is running:
```bash
docker-compose up --build -d
```
Ensure you have the following windows ready:
1. **Window 1 (User Facing):** The Next.js Frontend Dashboard (`http://localhost:3000`).
2. **Window 2 (Control Center):** Your terminal or API client to inject faults and hit webhooks.
3. **Window 3 (Chat):** Microsoft Teams with the AIOps Bot open.

---

## Scenario A: NovaCart Autonomous Healing

**Goal:** Demonstrate how the AIOps Agent detects a critical infrastructure failure and autonomously heals it without human intervention.

1. **The Setup:**
   Show the audience the NovaCart storefront. Click around, add items to the cart, and explain that this is a typical, high-traffic enterprise application.
   
2. **The Failure (Cart Outage):**
   Behind the scenes, inject a Redis cache failure to simulate an outage:
   ```bash
   curl -X POST http://localhost:3000/api/admin/faults \
     -H "Content-Type: application/json" \
     -d '{"fault": "isRedisDown", "active": true}'
   ```
   *Action:* Refresh the storefront. Show that the cart is now broken and returning a 503 error.
   
3. **The Autonomous Healing:**
   Explain that a traditional setup would page an engineer. Here, the AIOps agent detects the telemetry anomaly and triggers the remediation payload automatically:
   ```bash
   curl -X POST http://localhost:3000/api/admin/remediate \
     -H "Content-Type: application/json" \
     -d '{"action": "RESTART_REDIS"}'
   ```
   *Action:* Refresh the storefront. The cart is instantly restored.

---

## Scenario B: IBM MQ Diagnostics & Log Analysis

**Goal:** Show how the platform can interrogate legacy/complex infrastructure securely and perform autonomous log analysis.

1. **The Setup:**
   Explain that IBM MQ is a critical messaging backbone for the enterprise. You want to ensure it's healthy without manually logging into the mainframe or server.
   
2. **The Request:**
   In MS Teams, type: 
   *"Can you check the status of our MQ Queue Managers and fetch any recent error logs?"*
   
3. **The Execution:**
   The Agent Manager routes this intent to the `ibm_mq_mcp` server. The MCP server connects to the live MQ instance, utilizing tools like `dspmq` (to list Queue Managers) and `get_mq_logs` to fetch system errors.
   
4. **The Result:**
   The bot replies directly in Teams, summarizing which Queue Managers are running and highlighting any detected issues from the logs, completely automating the manual diagnostic step.

---

## Scenario C: MuleSoft & ServiceNow Integration

**Goal:** Demonstrate proactive infrastructure monitoring and automated IT Service Management (ITSM).

1. **The Setup:**
   Explain that the agent routinely polls MuleSoft CloudHub and Hybrid environments via the `rc_connector_mule` endpoints.
   
2. **The Anomaly Detection:**
   Simulate a Mule application failing, causing the Mule API (`/Connector/mule/hybrid`) to report `SERVER_DOWN`.
   
3. **The Ticket Generation:**
   Without any human intervention, the AIOps Agent utilizes the `servicenow-mcp` to generate a P1 Incident ticket in the IT Service Management system.
   
4. **The Resolution:**
   Open the ticket in ServiceNow. Show the audience that the AI Agent didn't just open a blank ticket—it attached a complete root-cause analysis and suggested remediation steps based on the MuleSoft error codes.

---

## Scenario D: Background Monitoring via Webhook

**Goal:** Show that agents don't just wait for chatbot inputs; they can be triggered programmatically by external monitoring tools (like Datadog or ELK).

1. **The Setup:**
   Explain that you have an external APM tool that sends alerts via webhooks. Show the pre-configured Webhook in the Agent Management Kit for the specific agent ID.
   
2. **The Trigger:**
   Simulate an alert firing by hitting the Webhook Invoke endpoint:
   ```bash
   curl -X POST http://localhost:8000/agent/<agent-id>/webhook/invoke/<webhook-id> \
     -H "Content-Type: application/json" \
     -d '{"prompt": "CPU usage spiked to 99% on the database cluster."}'
   ```
   
3. **The Background Execution:**
   Explain that the API immediately returns `202 Accepted` ("Webhook invocation started"). The agent is now running silently in the background, executing diagnostic tools without tying up the calling application. Once finished, it can automatically alert a Teams channel or resolve the issue.

---

## Scenario E: Automated Password Reset (Microsoft Entra ID)

**Goal:** Demonstrate the system's capability to securely handle sensitive identity management tasks, saving Tier 1 Helpdesk hours.

1. **The Request:**
   A user pings the Teams Bot: *"I forgot my password, can you reset it for user john.doe@example.com?"*
   
2. **The Verification & Execution:**
   The Agent Manager invokes the `microsoft_entra_connector`. The connector leverages the Microsoft Graph API to generate a highly secure password containing mixed characters.
   
3. **The Secure Hand-off:**
   The connector updates the Entra ID profile, sets `forceChangePasswordNextSignIn` to `True` for security compliance, and returns the generated, one-time password to the user in the secure Teams chat.
