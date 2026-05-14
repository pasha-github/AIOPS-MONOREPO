# Status App — Spring Boot + Docker + Datadog Logs

A minimal Spring Boot application exposing three REST endpoints to manage a global status variable.

The application logs a message when the status changes from `START` to `STOP`. When running with Docker Compose, the Datadog Agent container collects the application container logs and sends them to Datadog.

---

## Tech Stack

- Java 21
- Spring Boot 4
- Gradle
- Docker / Docker Compose
- Datadog Agent for log collection

---

## Endpoints

| Method | Path          | Description                      |
|--------|---------------|----------------------------------|
| POST   | `/api/start`  | Sets global status to `START`    |
| POST   | `/api/stop`   | Sets global status to `STOP`     |
| GET    | `/api/status` | Returns the current status value |

---

## Required Environment Variable

Before starting with Docker Compose, set your Datadog API key.

### Windows CMD

```cmd
set DD_API_KEY=your_datadog_api_key
```

### Windows PowerShell

```powershell
$env:DD_API_KEY="your_datadog_api_key"
```

### Linux / macOS / Git Bash

```bash
export DD_API_KEY=your_datadog_api_key
```

> Use a Datadog **API key**, not an application key.

For this project the Datadog site should be:

```text
us5.datadoghq.com
```

This should be configured in `compose.yaml` as:

```yaml
DD_SITE: us5.datadoghq.com
```

---

## Running with Docker Compose Recommended

From the project root:

```bash
docker compose down
docker compose up --build
```

This starts:

- `status-app` — Spring Boot application
- `datadog-agent` — collects Docker logs and sends them to Datadog

Stop containers:

```bash
docker compose down
```

---

## Running with Docker Directly Without Datadog Agent

Build the image:

```bash
docker build -t status-app .
```

Run the container:

```bash
docker run -p 8080:8080 status-app
```

This runs the app only. Logs will appear in Docker logs but will not be sent to Datadog unless the Datadog Agent is running separately.

---

## Running Locally Without Docker

Requires Java 21.

```bash
./gradlew bootRun
```

On Windows CMD:

```cmd
gradlew.bat bootRun
```

---

## Quick Test with curl

Set status to START:

```bash
curl -X POST http://localhost:8080/api/start
```

Set status to STOP:

```bash
curl -X POST http://localhost:8080/api/stop
```

Get current status:

```bash
curl http://localhost:8080/api/status
```

When calling `/api/stop` after `/api/start`, the app should log:

```text
Status changed from start to stop
```

---

## Check Application Logs

```bash
docker logs status-app
```

Expected log after calling `/api/start` then `/api/stop`:

```text
Status changed from start to stop
```

---

## Check Datadog Agent

```bash
docker logs datadog-agent
```

Or:

```bash
docker exec -it datadog-agent agent status
```

Look for:

```text
Logs Agent: Running
```

---

## Verify Logs in Datadog

Go to:

```text
Datadog → Logs → Explorer
```

Search:

```text
service:status-app
```

Or search by message:

```text
Status changed from start to stop
```

---

## Health Check

```bash
curl http://localhost:8080/actuator/health
```

---


