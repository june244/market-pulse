import { NextResponse } from 'next/server';

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const COINS = [
  { symbol: 'BTC-USD', label: 'Bitcoin' },
  { symbol: 'ETH-USD', label: 'Ethereum' },
];

export interface CoinChartPoint {
  timestamp: number;
  close: number;
}

export interface CoinPeriodReturn {
  period: string;
  changePercent: number;
}

export interface CoinData {
  symbol: string;
  label: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  chart: CoinChartPoint[];
  periodReturns: CoinPeriodReturn[];
}

async function fetchCoinData(symbol: string, label: string): Promise<CoinData | null> {
  try {
    // Fetch 1 year of daily data (covers all period calculations)
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`,
      {
        headers: { 'User-Agent': YAHOO_UA },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const meta = result.meta ?? {};

    if (timestamps.length === 0 || closes.length === 0) return null;

    const currentPrice = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
    const change = prevClose ? currentPrice - prevClose : 0;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    // Build chart points (last 6 months)
    const sixMonthsAgo = Date.now() / 1000 - 180 * 86400;
    const chart: CoinChartPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] >= sixMonthsAgo && closes[i] != null) {
        chart.push({ timestamp: timestamps[i], close: closes[i]! });
      }
    }

    // Calculate period returns
    const periods = [
      { label: '1M', days: 30 },
      { label: '3M', days: 90 },
      { label: '6M', days: 180 },
      { label: '1Y', days: 365 },
    ];

    const nowSec = timestamps[timestamps.length - 1];
    const periodReturns: CoinPeriodReturn[] = [];

    for (const { label: pLabel, days } of periods) {
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
      if (bestIdx >= 0 && closes[bestIdx] != null && closes[bestIdx]! > 0) {
        const pastPrice = closes[bestIdx]!;
        periodReturns.push({
          period: pLabel,
          changePercent: ((currentPrice - pastPrice) / pastPrice) * 100,
        });
      }
    }

    return { symbol, label, currentPrice, change, changePercent, chart, periodReturns };
  } catch (e) {
    console.error(`Coin fetch error for ${symbol}:`, e);
    return null;
  }
}

export async function GET() {
  const results = await Promise.all(
    COINS.map((c) => fetchCoinData(c.symbol, c.label))
  );

  return NextResponse.json(
    {
      coins: results.filter(Boolean),
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
      },
    }
  );
}
