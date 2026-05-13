import { NextResponse } from 'next/server';
import { serverState, addLog } from '@/lib/server-state';

export async function GET() {
  return NextResponse.json(serverState.faults);
}

export async function POST(request: Request) {
  try {
    const { fault, active } = await request.json();
    
    if (fault in serverState.faults) {
      serverState.faults[fault as keyof typeof serverState.faults] = active;
      addLog('aiops-control', `Fault toggled: ${fault} = ${active}`, 'warn');

      if (active === true && (fault === 'isRedisDown' || fault === 'isDbLatencyHigh')) {
        const webhookUrl = process.env.PAYMENT_FAILURE_WEBHOOK_URL;
        if (webhookUrl) {
          const faultName = fault === 'isRedisDown' ? 'Cart Outage' : 'Database Latency';
          const faultDetail = fault === 'isRedisDown' 
            ? "Service 'cart-service' is unable to connect to Redis. Users cannot manage their carts."
            : "Service 'product-service' is experiencing high response times due to database performance issues.";
          
          setTimeout(() => {
            // Check if fault is still active after 10s
            if (serverState.faults[fault as keyof typeof serverState.faults]) {
              fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `CRITICAL ALERT: Nova Shop ${faultName} detected. ${faultDetail} Please initiate automated diagnostic and remediation procedures.`
                })
              }).catch(err => {
                console.error('Failed to trigger webhook:', err);
                addLog('aiops-control', `Failed to trigger agent webhook: ${err.message}`, 'error');
              });
            }
          }, 10000);
        } else {
          addLog('aiops-control', 'PAYMENT_FAILURE_WEBHOOK_URL not configured, skipping agent notification', 'warn');
        }
      }

      return NextResponse.json({ success: true, faults: serverState.faults });
    }
    
    return NextResponse.json({ error: 'Unknown fault' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
