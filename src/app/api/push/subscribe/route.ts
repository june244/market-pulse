import { NextRequest, NextResponse } from 'next/server';
import { addSubscription, removeSubscription } from '@/lib/pushStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const sub = await req.json();
    if (!sub?.endpoint) {
      return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
    }
    addSubscription(sub);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'bad request' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const endpoint = body?.endpoint;
    if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
    removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'bad request' }, { status: 400 });
  }
}
