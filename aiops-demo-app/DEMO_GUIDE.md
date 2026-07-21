# NovaCart AIOps Demo Guide

Welcome to the NovaCart AIOps Demonstration. This guide will walk you through exactly how to present the autonomous healing capabilities of our platform to an audience.

## Setup Instructions

1. Ensure the application is running (`npm run dev`).
2. Open **two** separate browser windows/tabs:
   - **Window 1 (The Storefront):** Navigate to `http://localhost:3000`. Put this on the screen you are sharing with your audience.
   - **Window 2 (The Control Center):** Navigate to `http://localhost:3000/admin`. Keep this on your secondary monitor or hidden from the audience. This is your "wizard behind the curtain" dashboard.
3. Ensure your external AIOps AI Agent is running and configured to poll/monitor the application logs and metrics.

---

## The Demo Flow

### Phase 1: The Premium Experience
**Goal:** Show the audience that this is a real, functional, enterprise-grade application.

1. **On the Storefront (Window 1):** Scroll through the product catalog. Mention the sleek UI, the dynamic inventory tracking ("Only X left in stock!"), and the AI chatbot in the corner.
2. Add a few items to the cart.
3. Navigate to the cart page and demonstrate that the cart functions properly (you can delete items, view the total, etc.).

### Phase 2: The Failure (Cart Outage)
**Goal:** Simulate a catastrophic backend failure and show how the system degrades.

1. **On the Control Center (Window 2):** Under "Fault Injection Controls", click the **INJECT** button for the **Cart Outage**.
2. **On the Storefront (Window 1):** Refresh the page or try to add a new item to the cart.
3. **The Result:** The user will immediately see the user-friendly fallback UI: "Service Temporarily Unavailable. We're experiencing unusually high traffic right now."
4. **The Narrative:** "Oh no, our Redis cluster just went down. In a normal enterprise, this would trigger PagerDuty, wake up an SRE at 3 AM, and take 45 minutes to resolve while the company loses thousands of dollars in abandoned carts."

### Phase 3: The Autonomous Healing
**Goal:** Show the AI Agent stepping in and fixing the issue with zero human intervention.

1. At this point, your external AIOps AI Agent should detect the failure in the telemetry stream.
2. The AI Agent will automatically issue the `RESTART_REDIS` remediation payload (as defined in `SOP_GUIDE.md`).
3. **On the Storefront (Window 1):** Ask the audience to watch the screen. The error will disappear, and the cart will restore itself instantly.
4. **The Narrative:** "Notice how we didn't touch anything. Our AIOps agent detected the anomaly in the logs, referenced the SOP, and autonomously restarted the caching layer. The downtime was less than 30 seconds."

---

## Additional Scenarios

You can repeat the "Inject -> Detect -> Heal" loop using the other built-in scenarios:

### 1. Database Latency
- **Inject:** Click INJECT on **DB Latency** in the Control Center.
- **Show:** Go to the storefront homepage. The products will take over 3 seconds to load, showing a skeleton loader.
- **Heal:** The AI Agent will trigger `SCALE_DB_REPLICAS`.
- **Result:** Products instantly snap back to loading in <100ms.

### 2. Payment Gateway Timeout
- **Inject:** Click INJECT on **Payment Fail** in the Control Center.
- **Show:** Go to the cart and click "Proceed to Checkout". It will spin and eventually fail with a red error banner.
- **Heal:** The AI Agent will trigger `RESET_PAYMENT_GATEWAY`.
- **Result:** Click checkout again, and it will immediately succeed, clearing the cart and showing an Order Confirmation.

---

## Tips for a Great Demo
- **Use the Chatbot:** During the "downtime", you can open the Chatbot on the storefront and type "my cart is broken". It has simulated logic to respond with a reassuring message.
- **Watch the Logs:** The Control Center has a "Live Log Stream". If you share both screens side-by-side, the audience can literally watch the errors turn red, and then watch the AI agent's "Healing" commands come through in real-time.
