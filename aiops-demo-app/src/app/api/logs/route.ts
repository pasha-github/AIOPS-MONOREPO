import { NextResponse } from 'next/server';
import { serverState } from '@/lib/server-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(serverState.logs);
}
