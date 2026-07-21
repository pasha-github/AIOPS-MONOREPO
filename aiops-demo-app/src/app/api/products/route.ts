import { NextResponse } from 'next/server';
import { products } from '@/data/products';
import { serverState, addLog } from '@/lib/server-state';

export async function GET() {
  addLog('product-service', 'Fetching product catalog', 'info');

  if (serverState.faults.isDbLatencyHigh) {
    addLog('database', 'High latency detected on product queries', 'warn');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds latency
  }

  return NextResponse.json(products);
}
