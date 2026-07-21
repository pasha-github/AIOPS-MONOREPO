import { NextResponse } from 'next/server';
import { serverState, addLog } from '@/lib/server-state';

export async function GET() {
  addLog('order-processor', 'Fetching user orders', 'info');
  return NextResponse.json({ orders: serverState.orders });
}
