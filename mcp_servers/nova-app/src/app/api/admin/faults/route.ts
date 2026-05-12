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

      if (fault === 'isPaymentTimeout' && active === true) {
        const webhookUrl = process.env.PAYMENT_FAILURE_WEBHOOK_URL;
        if (webhookUrl) {
          addLog('aiops-control', 'Triggering external agent webhook for payment failure', 'info');
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: "CRITICAL ALERT: Nova Shop Payment Gateway connection timeout detected. Service 'payment-service' is returning 504 Gateway Timeout errors. Customer checkout is failing. Please initiate automated diagnostic and remediation procedures."
            })
          }).catch(err => {
            console.error('Failed to trigger webhook:', err);
            addLog('aiops-control', `Failed to trigger agent webhook: ${err.message}`, 'error');
          });
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
