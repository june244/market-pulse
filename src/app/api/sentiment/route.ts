import { NextRequest, NextResponse } from 'next/server';
import { getYahooCrumb, YAHOO_UA } from '@/lib/yahooAuth';
import { recordSnapshot } from '@/lib/sentimentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REDDIT_UA = 'MarketPulse/1.0 (web sentiment dashboard)';

export interface RedditPost {
  title: string;
  url: string;
  score: number;
  numComments: number;
  subreddit: string;
  createdUtc: number;
}

export interface AnalystConsensus {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
  mean: number | null;     // 1-5 (1=strong buy)
  key: string | null;      // "buy" | "hold" | etc.
}

export interface AnalystMonth {
  period: string;          // "0m" | "-1m" | "-2m" | "-3m"
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface SentimentEntry {
  symbol: string;
  analyst: AnalystConsensus | null;
  analystTrend: AnalystMonth[];   // 4-month historical (current first)
  reddit: {
    mentions: number;
    scoreSum: number;
    topPosts: RedditPost[];
  } | null;
  fetchedAt: string;
}

export interface SentimentResponse {
  data: Record<string, SentimentEntry>;
  updatedAt: string;
}

// 24h cache per symbol
const cache = new Map<string, { entry: SentimentEntry; expires: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

async function fetchAnalystData(symbol: string): Promise<{ consensus: AnalystConsensus | null; trend: AnalystMonth[] }> {
  try {
    const { crumb, cookies } = await getYahooCrumb();
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=recommendationTrend,financialData&crumb=${encodeURIComponent(crumb)}`;
    let res = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, Cookie: cookies },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) {
      const fresh = await getYahooCrumb(true);
      const retryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=recommendationTrend,financialData&crumb=${encodeURIComponent(fresh.crumb)}`;
      res = await fetch(retryUrl, {
        headers: { 'User-Agent': YAHOO_UA, Cookie: fresh.cookies },
        signal: AbortSignal.timeout(8000),
      });
    }
    if (!res.ok) return { consensus: null, trend: [] };
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return { consensus: null, trend: [] };

    const fin = result?.financialData;
    const trendRaw: any[] = result?.recommendationTrend?.trend ?? [];
    const trend: AnalystMonth[] = trendRaw.map((t) => ({
      period: t?.period ?? '',
      strongBuy: t?.strongBuy ?? 0,
      buy: t?.buy ?? 0,
      hold: t?.hold ?? 0,
      sell: t?.sell ?? 0,
      strongSell: t?.strongSell ?? 0,
    }));

    const t0 = trendRaw[0];
    const sb = t0?.strongBuy ?? 0;
    const b = t0?.buy ?? 0;
    const h = t0?.hold ?? 0;
    const s = t0?.sell ?? 0;
    const ss = t0?.strongSell ?? 0;
    const total = sb + b + h + s + ss;
    if (total === 0 && !fin?.recommendationMean?.raw) {
      return { consensus: null, trend };
    }

    return {
      consensus: {
        strongBuy: sb,
        buy: b,
        hold: h,
        sell: s,
        strongSell: ss,
        total,
        mean: fin?.recommendationMean?.raw ?? null,
        key: fin?.recommendationKey ?? null,
      },
      trend,
    };
  } catch {
    return { consensus: null, trend: [] };
  }
}

async function fetchRedditFromSub(sub: string, symbol: string): Promise<RedditPost[]> {
  try {
    const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&restrict_sr=1&sort=top&t=day&limit=15`;
    const res = await fetch(url, {
      headers: { 'User-Agent': REDDIT_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const children: any[] = data?.data?.children ?? [];
    const symU = symbol.toUpperCase();
    const posts: RedditPost[] = [];
    for (const child of children) {
      const d = child?.data;
      if (!d) continue;
      // Confirm the ticker actually appears as a token (avoid false matches)
      const haystack = ` ${(d.title ?? '')} ${(d.selftext ?? '')} `.toUpperCase();
      const tokenRe = new RegExp(`(^|[^A-Z])\\$?${symU}([^A-Z]|$)`);
      if (!tokenRe.test(haystack)) continue;
      posts.push({
        title: d.title ?? '',
        url: 'https://www.reddit.com' + (d.permalink ?? ''),
        score: d.score ?? 0,
        numComments: d.num_comments ?? 0,
        subreddit: d.subreddit ?? sub,
        createdUtc: d.created_utc ?? 0,
      });
    }
    return posts;
  } catch {
    return [];
  }
}

const REDDIT_SUBS = ['wallstreetbets', 'stocks', 'investing'];

async function fetchReddit(symbol: string): Promise<SentimentEntry['reddit']> {
  const results = await Promise.all(REDDIT_SUBS.map((s) => fetchRedditFromSub(s, symbol)));
  const all = results.flat();
  if (all.length === 0) return { mentions: 0, scoreSum: 0, topPosts: [] };

  // Dedupe by URL
  const seen = new Set<string>();
  const unique: RedditPost[] = [];
  for (const p of all) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    unique.push(p);
  }

  unique.sort((a, b) => b.score - a.score);
  const scoreSum = unique.reduce((sum, p) => sum + Math.max(0, p.score), 0);
  return {
    mentions: unique.length,
    scoreSum,
    topPosts: unique.slice(0, 5),
  };
}

async function fetchOne(symbol: string): Promise<SentimentEntry> {
  const [analystResult, reddit] = await Promise.all([
    fetchAnalystData(symbol),
    fetchReddit(symbol),
  ]);
  const entry: SentimentEntry = {
    symbol,
    analyst: analystResult.consensus,
    analystTrend: analystResult.trend,
    reddit,
    fetchedAt: new Date().toISOString(),
  };
  // Record daily snapshot for sentiment-history accumulation
  try {
    recordSnapshot({
      symbol,
      redditMentions: reddit?.mentions ?? 0,
      redditScoreSum: reddit?.scoreSum ?? 0,
      analystMean: entry.analyst?.mean ?? null,
      analystTotal: entry.analyst?.total ?? 0,
    });
  } catch {
    // non-critical
  }
  return entry;
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols') ?? '';
  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && /^[A-Z][A-Z0-9.\-^]{0,9}$/.test(s));

  if (symbols.length === 0) {
    return NextResponse.json({ data: {}, updatedAt: new Date().toISOString() } satisfies SentimentResponse);
  }

  const now = Date.now();
  const result: Record<string, SentimentEntry> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      const cached = cache.get(symbol);
      if (cached && cached.expires > now) {
        result[symbol] = cached.entry;
        return;
      }
      const entry = await fetchOne(symbol);
      cache.set(symbol, { entry, expires: now + TTL_MS });
      result[symbol] = entry;
    })
  );

  return NextResponse.json({
    data: result,
    updatedAt: new Date().toISOString(),
  } satisfies SentimentResponse);
}
