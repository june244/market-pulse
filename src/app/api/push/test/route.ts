import { NextRequest, NextResponse } from 'next/server';
import { sendPushToAll } from '@/lib/pushStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await sendPushToAll({
      title: body?.title || 'Market Pulse 테스트',
      body: body?.body || 'Push 알림이 잘 작동합니다.',
      url: '/',
      tag: 'test',
      severity: 'MED',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

export async function GET() {
  // Convenience GET so we can curl without payload
  try {
    const result = await sendPushToAll({
      title: 'Market Pulse 테스트',
      body: 'Push 알림이 잘 작동합니다.',
      url: '/',
      tag: 'test',
      severity: 'MED',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
