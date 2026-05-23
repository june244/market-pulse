import { NextRequest, NextResponse } from 'next/server';
import { generateBrief, getBriefCached, BriefInput, BriefEvent } from '@/lib/dailyBrief';
import { getCached } from '@/lib/sentimentCache';
import { getSeenTickers } from '@/lib/sentimentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function gatherInput(origin: string, symbols: string[]): Promise<BriefInput> {
  const symParam = symbols.join(',');
  const headers: Record<string, string> = {};
  if (process.env.AUTH_SECRET) headers['x-internal-key'] = process.env.AUTH_SECRET;
  const [marketRes, eventsRes] = await Promise.all([
    fetch(`${origin}/api/market?tickers=${encodeURIComponent(symParam)}`, { cache: 'no-store', headers }),
    fetch(`${origin}/api/ticker-events?symbols=${encodeURIComponent(symParam)}`, { cache: 'no-store', headers }),
  ]);

  const market = marketRes.ok ? await marketRes.json() : {};
  const events = eventsRes.ok ? await eventsRes.json() : { events: [] };

  const nowDayStart = startOfDayUTC(new Date());
  const upcomingEvents: BriefEvent[] = (events.events ?? [])
    .map((e: any) => {
      const eventDayStart = startOfDayUTC(new Date(e.date));
      const daysUntil = Math.round((eventDayStart - nowDayStart) / 86400000);
      return { symbol: e.symbol, type: e.type, daysUntil };
    })
    .filter((e: BriefEvent) => e.daysUntil >= 0 && e.daysUntil <= 3);

  const tickerSnapshots = await Promise.all((market.tickers ?? []).map(async (t: any) => {
    const sentiment = await getCached(t.symbol);
    return {
      symbol: t.symbol,
      changePercent: t.changePercent,
      analystMean: sentiment?.analyst?.mean ?? null,
      redditMentions: sentiment?.reddit?.mentions ?? null,
    };
  }));

  return {
    date: todayET(),
    fearGreed: market.fearGreed
      ? { score: market.fearGreed.score, rating: market.fearGreed.rating }
      : null,
    vix: market.vix
      ? { value: market.vix.value, changePercent: market.vix.changePercent }
      : null,
    macro: (market.macro ?? []).map((m: any) => ({
      label: m.label,
      changePercent: m.changePercent,
    })),
    tickers: tickerSnapshots,
    upcomingEvents,
  };
}

async function parseSymbols(req: NextRequest): Promise<string[]> {
  const param = req.nextUrl.searchParams.get('symbols') ?? '';
  if (param) {
    return param
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && /^[A-Z][A-Z0-9.\-^]{0,9}$/.test(s));
  }
  return (await getSeenTickers()).slice(0, 12);
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === '1';
  const dateKey = todayET();

  if (!force) {
    const cached = await getBriefCached(dateKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  const symbols = await parseSymbols(req);
  if (symbols.length === 0) {
    return NextResponse.json({ error: 'no symbols' }, { status: 400 });
  }

  try {
    const origin = new URL(req.url).origin;
    const input = await gatherInput(origin, symbols);
    const brief = await generateBrief(input);
    return NextResponse.json(brief);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'brief generation failed' },
      { status: 500 },
    );
  }
}
