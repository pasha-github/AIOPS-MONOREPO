// In Next.js dev mode, global variables can be recreated unless we attach them to globalThis
const globalForState = globalThis as unknown as {
  _novaCartState: {
    faults: {
      isRedisDown: boolean;
      isDbLatencyHigh: boolean;
      isPaymentTimeout: boolean;
    };
    logs: any[];
    metrics: any[];
  };
};

if (!globalForState._novaCartState) {
  globalForState._novaCartState = {
    faults: {
      isRedisDown: false,
      isDbLatencyHigh: false,
      isPaymentTimeout: false,
    },
    logs: [],
    metrics: [],
  };
}

export const serverState = globalForState._novaCartState;

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
