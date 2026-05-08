import { NextRequest, NextResponse } from 'next/server';
import { getYahooCrumb, YAHOO_UA } from '@/lib/yahooAuth';
import { getSnapshotsFor, DailySentimentSnapshot } from '@/lib/sentimentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnalystMonth {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface SentimentHistoryResponse {
  symbol: string;
  analystTrend: AnalystMonth[];
  redditDaily: { date: string; mentions: number; scoreSum: number }[];
  fetchedAt: string;
}

async function fetchAnalystTrend(symbol: string): Promise<AnalystMonth[]> {
  try {
    const { crumb, cookies } = await getYahooCrumb();
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=recommendationTrend&crumb=${encodeURIComponent(crumb)}`;
    let res = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, Cookie: cookies },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) {
      const fresh = await getYahooCrumb(true);
      const retryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=recommendationTrend&crumb=${encodeURIComponent(fresh.crumb)}`;
      res = await fetch(retryUrl, {
        headers: { 'User-Agent': YAHOO_UA, Cookie: fresh.cookies },
        signal: AbortSignal.timeout(8000),
      });
    }
    if (!res.ok) return [];
    const json = await res.json();
    const trend: any[] = json?.quoteSummary?.result?.[0]?.recommendationTrend?.trend ?? [];
    return trend.map((t) => ({
      period: t?.period ?? '',
      strongBuy: t?.strongBuy ?? 0,
      buy: t?.buy ?? 0,
      hold: t?.hold ?? 0,
      sell: t?.sell ?? 0,
      strongSell: t?.strongSell ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? '').trim().toUpperCase();
  if (!symbol || !/^[A-Z][A-Z0-9.\-^]{0,9}$/.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10) || 30, 180);

  const [analystTrend, snapshots] = await Promise.all([
    fetchAnalystTrend(symbol),
    Promise.resolve(getSnapshotsFor(symbol, days)),
  ]);

  const redditDaily = snapshots.map((s: DailySentimentSnapshot) => ({
    date: s.date,
    mentions: s.redditMentions,
    scoreSum: s.redditScoreSum,
  }));

  return NextResponse.json({
    symbol,
    analystTrend,
    redditDaily,
    fetchedAt: new Date().toISOString(),
  } satisfies SentimentHistoryResponse);
}
