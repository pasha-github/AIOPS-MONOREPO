/**
 * Cart API
 * Simulates a Redis-backed shopping cart microservice.
 * Supports GET (fetch), POST (add), and DELETE (remove) operations.
 */
import { NextResponse } from 'next/server';
import { serverState, addLog } from '@/lib/server-state';

// In-memory cart store simulating Redis
const mockCartDB: Record<string, any[]> = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'default-user';

  addLog('cart-service', `Fetching cart for ${userId}`, 'info');

  if (serverState.faults.isRedisDown) {
    addLog('redis', 'Connection refused: Redis node unreachable', 'error');
    return NextResponse.json({ error: 'Cart service unavailable' }, { status: 503 });
  }

  const cart = mockCartDB[userId] || [];
  return NextResponse.json(cart);
}

export async function POST(request: Request) {
  addLog('cart-service', 'Adding item to cart', 'info');

  if (serverState.faults.isRedisDown) {
    addLog('redis', 'Connection refused: Redis node unreachable', 'error');
    return NextResponse.json({ error: 'Cart service unavailable' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { userId = 'default-user', product } = body;
    
    if (!mockCartDB[userId]) {
      mockCartDB[userId] = [];
    }
    
    // Check if exists
    const existing = mockCartDB[userId].find(p => p.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      mockCartDB[userId].push({ ...product, quantity: 1 });
    }

    addLog('cart-service', `Item ${product.id} added successfully`, 'info');
    return NextResponse.json(mockCartDB[userId]);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  addLog('cart-service', 'Removing item from cart', 'info');

  if (serverState.faults.isRedisDown) {
    addLog('redis', 'Connection refused: Redis node unreachable', 'error');
    return NextResponse.json({ error: 'Cart service unavailable' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    if (productId === 'clear') {
      mockCartDB[userId] = [];
      addLog('cart-service', `Cart cleared successfully`, 'info');
    } else if (mockCartDB[userId]) {
      mockCartDB[userId] = mockCartDB[userId].filter(p => p.id !== productId);
      addLog('cart-service', `Item ${productId} removed successfully`, 'info');
    }

    return NextResponse.json(mockCartDB[userId] || []);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
