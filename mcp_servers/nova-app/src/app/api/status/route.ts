import { NextResponse } from 'next/server';
import { serverState } from '@/lib/server-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = {
    database: {
      status: serverState.faults.isDbLatencyHigh ? 'degraded' : 'healthy',
      latency: serverState.faults.isDbLatencyHigh ? 'high (3000ms)' : 'normal (<100ms)',
      message: serverState.faults.isDbLatencyHigh ? 'Database is experiencing high query latency' : 'Database is performing within normal parameters'
    },
    cache: {
      status: serverState.faults.isRedisDown ? 'offline' : 'healthy',
      type: 'Redis',
      message: serverState.faults.isRedisDown ? 'Redis connection refused' : 'Cache service is operational'
    },
    paymentGateway: {
      status: serverState.faults.isPaymentTimeout ? 'degraded' : 'healthy',
      message: serverState.faults.isPaymentTimeout ? 'Gateway timeout detected' : 'Payment gateway is responsive'
    },
    overallStatus: (serverState.faults.isRedisDown || serverState.faults.isDbLatencyHigh || serverState.faults.isPaymentTimeout) ? 'unhealthy' : 'healthy',
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(status);
}
