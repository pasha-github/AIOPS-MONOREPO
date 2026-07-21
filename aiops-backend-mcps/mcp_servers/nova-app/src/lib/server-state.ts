// In Next.js dev mode, global variables can be recreated unless we attach them to globalThis
const globalForState = globalThis as unknown as {
  _novaCartState: {
    faults: {
      isRedisDown: boolean;
      isDbLatencyHigh: boolean;
      isPaymentTimeout: boolean;
      isBatchJobFailed: boolean;
    };
    logs: any[];
    metrics: any[];
    orders: any[];
    carts: Record<string, any[]>;
  };
  _jobInterval?: ReturnType<typeof setInterval>;
};

if (!globalForState._novaCartState) {
  globalForState._novaCartState = {
    faults: {
      isRedisDown: false,
      isDbLatencyHigh: false,
      isPaymentTimeout: false,
      isBatchJobFailed: false,
    },
    logs: [],
    metrics: [],
    orders: [],
    carts: {},
  };
}

export const serverState = globalForState._novaCartState;

// Background batch job for order processing
if (!globalForState._jobInterval) {
  globalForState._jobInterval = setInterval(() => {
    if (!serverState.faults.isBatchJobFailed) {
      let processed = false;
      serverState.orders.forEach(o => {
        if (o.status === 'Payment Pending') {
          o.status = 'Order Placed';
          processed = true;
        }
      });
      if (processed) {
        addLog('order-processor', 'Batch job completed: Processed pending orders', 'info');
      }
    }
  }, 10000); // Runs every 10 seconds
}

export function addLog(service: string, message: string, level: 'info' | 'warn' | 'error' | 'fatal') {
  serverState.logs.unshift({
    timestamp: new Date().toISOString(),
    service,
    message,
    level,
  });
  // keep last 100
  if (serverState.logs.length > 100) serverState.logs.pop();
}
