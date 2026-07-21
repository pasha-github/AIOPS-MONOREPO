import { NextResponse } from 'next/server';
import { serverState, addLog } from '@/lib/server-state';

export async function POST(request: Request) {
  addLog('checkout-gateway', 'Processing checkout request', 'info');

  if (serverState.faults.isPaymentTimeout) {
    addLog('payment-service', 'Connection timeout to payment provider', 'error');
    // Simulate long delay then fail
    await new Promise(resolve => setTimeout(resolve, 5000));
    return NextResponse.json({ error: 'Payment gateway timeout' }, { status: 504 });
  }

  // Simulate normal processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  addLog('payment-service', 'Payment processed successfully', 'info');
  const userId = 'demo-user'; // Fixed: Match user ID used by the cart store
  const cartItems = serverState.carts[userId] || [];
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal * 1.08; // Include 8% mock tax

  const newOrder = {
    id: `ORD-${Math.floor(Math.random() * 1000000)}`,
    date: new Date().toISOString(),
    total,
    status: 'Payment Pending',
    items: [...cartItems],
  };
  serverState.orders.push(newOrder);

  addLog('order-service', 'Order created successfully', 'info');
  addLog('notification-service', 'Order confirmation email sent', 'info');

  return NextResponse.json({ success: true, orderId: newOrder.id });
}
