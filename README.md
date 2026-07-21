# NovaCart Retail Demo Platform

NovaCart is a next-generation, high-performance eCommerce storefront built specifically for demonstrating Enterprise AIOps, Observability, and Autonomous Healing workflows. It provides a beautiful, fully functional storefront that can be easily broken and healed via an API-driven Control Center.

## Overview

The platform consists of two main interfaces:
1. **The Storefront**: A premium retail experience where users can browse products, add them to a cart, interact with an AI Chatbot, and checkout.
2. **The Infrastructure Control Center**: A hidden "wizard behind the curtain" dashboard where presenters can inject catastrophic backend failures (e.g., Redis outages, DB latency spikes) and monitor the live log stream.

---

## Important URLs

Once the application is running locally (e.g., via `npm run dev`), you can access the following:

- **Storefront URL**: [http://localhost:3000](http://localhost:3000)
  - This is the main customer-facing application. Keep this on your primary monitor when demonstrating to an audience.
  
- **Control Center (Admin) URL**: [http://localhost:3000/admin](http://localhost:3000/admin)
  - This is the hidden dashboard for injecting faults. Do not link to this from the storefront. Access it directly via the URL on a secondary screen.

---

## Fault Injection & Autonomous Healing APIs

This demo platform is designed to be monitored and manipulated by external AI Agents. The system state is controlled via two primary API endpoints.

### 1. Fault Injection Endpoint
**URL**: `POST /api/admin/faults`

Use this endpoint to simulate infrastructure failures.
```bash
# Example: Triggering a Redis Outage
curl -X POST http://localhost:3000/api/admin/faults \
  -H "Content-Type: application/json" \
  -d '{"fault": "isRedisDown", "active": true}'
```
*Available faults: `isRedisDown`, `isDbLatencyHigh`, `isPaymentTimeout`.*

### 2. Remediation (Healing) Endpoint
**URL**: `POST /api/admin/remediate`

Use this endpoint to heal the simulated failures. External AIOps agents should call this after detecting an anomaly.
```bash
# Example: Healing the Redis Outage
curl -X POST http://localhost:3000/api/admin/remediate \
  -H "Content-Type: application/json" \
  -d '{"action": "RESTART_REDIS"}'
```
*Available actions: `RESTART_REDIS`, `SCALE_DB_REPLICAS`, `RESET_PAYMENT_GATEWAY`.*

---

## Documentation Guide

For detailed instructions on how to use this platform, please refer to the following documents included in this repository:

1. **[DEMO_GUIDE.md](./DEMO_GUIDE.md)**: A step-by-step playbook for human presenters on how to set up screens, inject faults, and the exact narrative script to use when showing off the platform.
2. **[SOP_GUIDE.md](./SOP_GUIDE.md)**: A programmatic Standard Operating Procedure (SOP) designed explicitly for consumption by autonomous AI Agents. It outlines the exact API payloads required to heal specific system states.

---

## Getting Started

To run the platform locally:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
