import { NextRequest, NextResponse } from 'next/server';
import { generateBrief, getBriefCached, BriefInput, BriefEvent, BriefPortfolioSnapshot } from '@/lib/dailyBrief';
import { getCached } from '@/lib/sentimentCache';
import { getSeenTickers } from '@/lib/sentimentStore';
import { auth } from '@/auth';
import { getUserData, UserData } from '@/lib/userDataStore';
import { calcPosition } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function buildPortfolioSnapshot(marketTickers: any[], userData: UserData | null): BriefPortfolioSnapshot | null {
  if (!userData) return null;

  let totalValue = 0;
  let dailyChange = 0;
  const contributors: { symbol: string; amount: number; changePercent: number }[] = [];

  for (const ticker of marketTickers) {
    const trades = userData.trades[ticker.symbol] ?? [];
    if (trades.length === 0) continue;
    const position = calcPosition(trades);
    if (position.totalQty <= 0) continue;

    const value = ticker.price * position.totalQty;
    const amount = ticker.change * position.totalQty;
    totalValue += value;
    dailyChange += amount;
    contributors.push({
      symbol: ticker.symbol,
      amount,
      changePercent: ticker.changePercent,
    });
  }

  if (totalValue <= 0 || contributors.length === 0) return null;

  const prevValue = totalValue - dailyChange;
  const dailyChangePercent = prevValue > 0 ? (dailyChange / prevValue) * 100 : 0;

  return {
    totalValue,
    dailyChange,
    dailyChangePercent,
    leaders: contributors.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 2),
    laggards: contributors.filter((c) => c.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 2),
  };
}

function briefCacheKey(dateKey: string, email: string | null, symbols: string[]): string {
  const scope = email ? `user:${email}` : `symbols:${symbols.join(',')}`;
  return `${dateKey}:${scope}`;
}

async function gatherInput(origin: string, symbols: string[], userData: UserData | null, cacheKey: string): Promise<BriefInput> {
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

  const marketTickers = market.tickers ?? [];
  const tickerSnapshots = await Promise.all(marketTickers.map(async (t: any) => {
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
    cacheKey,
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
    portfolio: buildPortfolioSnapshot(marketTickers, userData),
  };
}

async function parseSymbols(req: NextRequest, userData: UserData | null): Promise<string[]> {
  const param = req.nextUrl.searchParams.get('symbols') ?? '';
  if (param) {
    return param
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && /^[A-Z][A-Z0-9.\-^]{0,9}$/.test(s));
  }
  if (userData?.tickers.length) return userData.tickers.slice(0, 12);
  return (await getSeenTickers()).slice(0, 12);
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === '1';
  const dateKey = todayET();
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  const userData = email ? await getUserData(email) : null;
  const symbols = await parseSymbols(req, userData);
  const cacheKey = briefCacheKey(dateKey, email, symbols);

  if (!force) {
    const cached = await getBriefCached(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'no symbols' }, { status: 400 });
  }

  try {
    const origin = new URL(req.url).origin;
    const input = await gatherInput(origin, symbols, userData, cacheKey);
    const brief = await generateBrief(input);
    return NextResponse.json(brief);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'brief generation failed' },
      { status: 500 },
    );
  }
}
