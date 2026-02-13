import { NextRequest, NextResponse } from 'next/server';
import { PeriodReturns, MacroItem } from '@/lib/types';

const MACRO_SYMBOLS: Record<string, string> = {
  '^TNX': '10Y Yield',
  'DX-Y.NYB': 'Dollar',
  'GC=F': 'Gold',
  'CL=F': 'Oil',
  'BTC-USD': 'BTC',
  'ETH-USD': 'ETH',
};

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// --- Yahoo Finance crumb + cookie auth ---
let cachedCrumb: string | null = null;
let cachedCookies: string | null = null;
let crumbExpiry = 0;

async function getYahooCrumb(forceRefresh = false): Promise<{ crumb: string; cookies: string }> {
  if (!forceRefresh && cachedCrumb && cachedCookies && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookies: cachedCookies };
  }

  // Step 1: Hit fc.yahoo.com to obtain consent cookies
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': YAHOO_UA },
    redirect: 'manual',
    cache: 'no-store',
  });

  const setCookieHeaders = cookieRes.headers.getSetCookie?.() ?? [];
  const cookies = setCookieHeaders.map((c: string) => c.split(';')[0]).join('; ');
  if (!cookies) throw new Error('No cookies received from Yahoo');

  // Step 2: Exchange cookies for a crumb token
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': YAHOO_UA,
      'Cookie': cookies,
    },
    cache: 'no-store',
  });
  if (!crumbRes.ok) throw new Error(`Crumb fetch failed: ${crumbRes.status}`);
  const crumb = await crumbRes.text();

  // Cache for 20 minutes
  cachedCrumb = crumb;
  cachedCookies = cookies;
  crumbExpiry = Date.now() + 20 * 60 * 1000;

  return { crumb, cookies };
}

// CNN Fear & Greed Index - unofficial endpoint
async function fetchFearGreed() {
  try {
    const res = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        'User-Agent': YAHOO_UA,
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) throw new Error(`FG status: ${res.status}`);
    const data = await res.json();
    return {
      score: Math.round(data?.fear_and_greed?.score ?? 0),
      rating: data?.fear_and_greed?.rating ?? 'unknown',
      timestamp: data?.fear_and_greed?.timestamp ?? null,
    };
  } catch (e) {
    console.error('Fear & Greed fetch error:', e);
    return null;
  }
}

// Yahoo Finance - quote endpoint with crumb auth
async function fetchQuotes(symbols: string[]) {
  try {
    const { crumb, cookies } = await getYahooCrumb();
    const symbolStr = symbols.join(',');
    let res = await fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolStr)}&crumb=${encodeURIComponent(crumb)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,marketCap,shortName,marketState`,
      {
        headers: {
          'User-Agent': YAHOO_UA,
          'Accept': 'application/json',
          'Cookie': cookies,
        },
        next: { revalidate: 60 },
      }
    );

    // If 401, refresh crumb and retry once
    if (res.status === 401) {
      const fresh = await getYahooCrumb(true);
      res = await fetch(
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolStr)}&crumb=${encodeURIComponent(fresh.crumb)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,marketCap,shortName,marketState`,
        {
          headers: {
            'User-Agent': YAHOO_UA,
            'Accept': 'application/json',
            'Cookie': fresh.cookies,
          },
          cache: 'no-store',
        }
      );
    }

    if (!res.ok) throw new Error(`Yahoo status: ${res.status}`);
    const data = await res.json();
    const results = data?.quoteResponse?.result ?? [];
    return results.map((q: any) => ({
      symbol: q.symbol,
      name: q.shortName ?? q.symbol,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      prevClose: q.regularMarketPreviousClose ?? 0,
      open: q.regularMarketOpen ?? 0,
      dayHigh: q.regularMarketDayHigh ?? 0,
      dayLow: q.regularMarketDayLow ?? 0,
      volume: q.regularMarketVolume ?? 0,
      marketCap: q.marketCap ?? 0,
      marketState: q.marketState ?? 'CLOSED',
    }));
  } catch (e) {
    console.error('Yahoo Finance fetch error:', e);
    return [];
  }
}

// VIX via Yahoo Finance
async function fetchVIX() {
  const quotes = await fetchQuotes(['^VIX']);
  return quotes[0] ?? null;
}

// Historical period returns + sparkline via Yahoo Finance v8 Chart API (no crumb needed)
interface HistoricalData {
  periodReturns: PeriodReturns;
  sparkline: number[];
}

async function fetchHistoricalData(symbols: string[]): Promise<Record<string, HistoricalData>> {
  const periods = [
    { key: '1M' as const, days: 30 },
    { key: '3M' as const, days: 90 },
    { key: '6M' as const, days: 180 },
    { key: '1Y' as const, days: 365 },
  ];

  const results: Record<string, HistoricalData> = {};

  const fetches = symbols.map(async (symbol) => {
    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1wk`,
        {
          headers: { 'User-Agent': YAHOO_UA },
          next: { revalidate: 3600 },
        }
      );
      if (!res.ok) return;

      const data = await res.json();
      const chart = data?.chart?.result?.[0];
      if (!chart) return;

      const timestamps: number[] = chart.timestamp ?? [];
      const closes: number[] = chart.indicators?.quote?.[0]?.close ?? [];
      if (timestamps.length === 0 || closes.length === 0) return;

      const currentPrice = closes[closes.length - 1];
      if (currentPrice == null) return;

      const nowSec = timestamps[timestamps.length - 1];
      const periodReturns: PeriodReturns = { '1M': null, '3M': null, '6M': null, '1Y': null };

      for (const { key, days } of periods) {
        const targetSec = nowSec - days * 86400;
        let bestIdx = -1;
        let bestDiff = Infinity;
        for (let i = 0; i < timestamps.length; i++) {
          const diff = Math.abs(timestamps[i] - targetSec);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0 && closes[bestIdx] != null && closes[bestIdx] !== 0) {
          const pastPrice = closes[bestIdx];
          periodReturns[key] = {
            price: pastPrice,
            changePercent: ((currentPrice - pastPrice) / pastPrice) * 100,
          };
        }
      }

      // Sparkline: last 26 weeks of valid closing prices
      const sparkline = closes
        .slice(-26)
        .filter((v): v is number => v != null);

      results[symbol] = { periodReturns, sparkline };
    } catch (e) {
      console.error(`Historical fetch error for ${symbol}:`, e);
    }
  });

  await Promise.all(fetches);
  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers') || '';
  const userTickers = tickersParam
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  // Batch VIX + macro + user tickers into one API call
  const macroSymbols = Object.keys(MACRO_SYMBOLS);
  const macroSet = new Set(macroSymbols);
  const allSymbols = [
    '^VIX',
    ...macroSymbols,
    ...userTickers.filter((t) => t !== '^VIX' && !macroSet.has(t)),
  ];

  const [fearGreed, quotes, historical] = await Promise.all([
    fetchFearGreed(),
    fetchQuotes(allSymbols),
    userTickers.length > 0 ? fetchHistoricalData(userTickers) : Promise.resolve({} as Record<string, HistoricalData>),
  ]);

  // Partition quotes into VIX / macro / user tickers
  const vixQuote = quotes.find((q: any) => q.symbol === '^VIX');

  const macro: MacroItem[] = macroSymbols
    .map((sym) => {
      const q = quotes.find((qt: any) => qt.symbol === sym);
      if (!q) return null;
      return {
        symbol: sym,
        label: MACRO_SYMBOLS[sym],
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
      };
    })
    .filter((m): m is MacroItem => m !== null);

  const tickerQuotes = quotes.filter(
    (q: any) => q.symbol !== '^VIX' && !macroSet.has(q.symbol)
  );

  // Merge historical data into ticker data
  const tickersWithReturns = tickerQuotes.map((t: any) => {
    const hist = historical[t.symbol];
    return {
      ...t,
      periodReturns: hist?.periodReturns ?? undefined,
      sparkline: hist?.sparkline ?? undefined,
    };
  });

  return NextResponse.json({
    fearGreed,
    vix: vixQuote
      ? {
          value: vixQuote.price,
          change: vixQuote.change,
          changePercent: vixQuote.changePercent,
        }
      : null,
    macro,
    tickers: tickersWithReturns,
    updatedAt: new Date().toISOString(),
  });
}
