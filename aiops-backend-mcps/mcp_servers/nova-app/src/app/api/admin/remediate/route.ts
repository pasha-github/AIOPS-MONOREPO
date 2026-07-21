import { NextResponse } from 'next/server';
import { serverState, addLog } from '@/lib/server-state';

export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    
    addLog('aiops-agent', `Received remediation command: ${action}`, 'info');

    switch (action) {
      case 'RESTART_REDIS':
        serverState.faults.isRedisDown = false;
        addLog('infrastructure', 'Redis pod restarted successfully', 'info');
        break;
      case 'SCALE_DB_REPLICAS':
        serverState.faults.isDbLatencyHigh = false;
        addLog('infrastructure', 'Database read replicas scaled up to handle load', 'info');
        break;
      case 'RESET_PAYMENT_GATEWAY':
        serverState.faults.isPaymentTimeout = false;
        addLog('infrastructure', 'Payment gateway circuit breaker reset', 'info');
        break;
      case 'RUN_BATCH_JOB':
        serverState.faults.isBatchJobFailed = false;
        let processed = false;
        serverState.orders.forEach(o => {
          if (o.status === 'Payment Pending') {
            o.status = 'Order Placed';
            processed = true;
          }
        });
        if (processed) {
          addLog('order-processor', 'Batch job triggered manually: Processed backlogged orders', 'info');
        } else {
          addLog('infrastructure', 'Order processing batch job triggered manually', 'info');
        }
        break;
      default:
        addLog('aiops-agent', `Unknown remediation command: ${action}`, 'warn');
        return NextResponse.json({ error: 'Unknown remediation action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Action ${action} executed successfully`, faults: serverState.faults });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
