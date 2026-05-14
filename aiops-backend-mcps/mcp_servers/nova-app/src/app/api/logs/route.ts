import { NextResponse } from 'next/server';
import { serverState } from '@/lib/server-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(serverState.logs);
}

export async function DELETE() {
  serverState.logs = [];
  return NextResponse.json({ success: true });
}
