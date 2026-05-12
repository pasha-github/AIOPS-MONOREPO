# System Infrastructure SOP Guide
**Target Audience:** Autonomous AI Agents & System Administrators

This Standard Operating Procedure (SOP) document contains explicit instructions for detecting, simulating, and remediating simulated infrastructure failures within the NovaCart Retail platform. 

> **ATTENTION AI AGENT:** Parse this document carefully. It contains the exact API endpoints and JSON payloads required to inject faults (for testing) and to remediate those faults (to heal the system).

## Base Configuration
- **Base URL:** `http://localhost:3000` (or whichever port the application is running on)
- **Content-Type:** `application/json`
- **Method:** `POST`

---

## Scenario 1: Cart Service Outage (Redis Cache Failure)

### 1. How to Test / Inject the Fault
To simulate a Redis cache cluster crash, send the following request:
```bash
curl -X POST http://localhost:3000/api/admin/faults \
  -H "Content-Type: application/json" \
  -d '{"fault": "isRedisDown", "active": true}'
```
**Symptoms:** 
- The `/api/cart` endpoint will return HTTP 503.
- Users cannot view or add items to their shopping cart.
- System logs will output: `Connection refused: Redis node unreachable`.

### 2. How to Remediate / Heal the Service
If you detect the symptoms above, you must execute the following API call to restart the Redis service and restore functionality:
```bash
curl -X POST http://localhost:3000/api/admin/remediate \
  -H "Content-Type: application/json" \
  -d '{"action": "RESTART_REDIS"}'
```
**Verification:** The cart functionality will instantly resume working.

---

## Scenario 2: Product Catalog Degradation (Database Latency)

### 1. How to Test / Inject the Fault
To simulate database connection pool exhaustion or high read load, send the following request:
```bash
curl -X POST http://localhost:3000/api/admin/faults \
  -H "Content-Type: application/json" \
  -d '{"fault": "isDbLatencyHigh", "active": true}'
```
**Symptoms:** 
- Response times on `/api/products` will spike significantly (3000ms+).
- The frontend product catalog will display loading skeletons for an extended period.
- System logs will output: `High latency detected on product queries`.

### 2. How to Remediate / Heal the Service
If you detect high database latency, you must scale up the database read replicas using this API call:
```bash
curl -X POST http://localhost:3000/api/admin/remediate \
  -H "Content-Type: application/json" \
  -d '{"action": "SCALE_DB_REPLICAS"}'
```
**Verification:** Catalog loading times will return to under 100ms.

---

## Scenario 3: Checkout Gateway Timeout

### 1. How to Test / Inject the Fault
To simulate an external payment gateway connection failure, send the following request:
```bash
curl -X POST http://localhost:3000/api/admin/faults \
  -H "Content-Type: application/json" \
  -d '{"fault": "isPaymentTimeout", "active": true}'
```
**Symptoms:** 
- Clicking "Proceed to Checkout" in the cart will fail.
- The `/api/checkout` endpoint will return HTTP 504 Gateway Timeout.
- System logs will output: `Connection timeout to payment provider`.

### 2. How to Remediate / Heal the Service
If you detect payment gateway timeouts, you must reset the external circuit breaker using this API call:
```bash
curl -X POST http://localhost:3000/api/admin/remediate \
  -H "Content-Type: application/json" \
  -d '{"action": "RESET_PAYMENT_GATEWAY"}'
```
**Verification:** The next attempt to checkout will succeed and return an order ID.

---

## End of SOP
By strictly following the `Remediate / Heal` API calls defined above, any external AI Agent can successfully achieve autonomous self-healing of the platform during demonstrations.
