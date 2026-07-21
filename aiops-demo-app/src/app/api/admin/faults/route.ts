import { NextResponse } from 'next/server';
import { serverState, addLog } from '@/lib/server-state';

export async function GET() {
  return NextResponse.json(serverState.faults);
}

export async function POST(request: Request) {
  try {
    const { fault, active } = await request.json();
    
    if (fault in serverState.faults) {
      serverState.faults[fault as keyof typeof serverState.faults] = active;
      addLog('aiops-control', `Fault toggled: ${fault} = ${active}`, 'warn');
      return NextResponse.json({ success: true, faults: serverState.faults });
    }
    
    return NextResponse.json({ error: 'Unknown fault' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
