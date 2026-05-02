import { NextRequest, NextResponse } from 'next/server';
import { Trade } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface RequestBody {
  trades: Record<string, Trade[]>;
}

export interface PortfolioPoint {
  date: string;       // YYYY-MM-DD
  value: number;      // current holdings value
  invested: number;   // cumulative net invested (buy cost - sell proceeds applied at avg cost)
  plPercent: number;  // total return % vs cost basis
  plAmount: number;   // total $ return
}

export interface PortfolioHistoryResponse {
  points: PortfolioPoint[];
}

interface SymbolSeries {
  // dateKey -> close price
  prices: Map<string, number>;
}

async function fetchSymbolHistory(symbol: string, days: number): Promise<SymbolSeries | null> {
  try {
    const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : '1y';
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
      { headers: { 'User-Agent': YAHOO_UA }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const chart = data?.chart?.result?.[0];
    if (!chart) return null;
    const timestamps: number[] = chart.timestamp ?? [];
    const closes: number[] = chart.indicators?.quote?.[0]?.close ?? [];
    if (timestamps.length === 0 || closes.length === 0) return null;

    const prices = new Map<string, number>();
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null) continue;
      const dateKey = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      prices.set(dateKey, close);
    }
    return { prices };
  } catch (e) {
    console.error(`Symbol history fetch failed: ${symbol}`, e);
    return null;
  }
}

// Compute running position state up to (and including) `dateKey`, plus realized PL.
function positionAt(trades: Trade[], dateKey: string): { qty: number; avgCost: number; realized: number; investedTotal: number } {
  let qty = 0;
  let totalCost = 0;
  let realized = 0;
  let investedTotal = 0;

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const t of sorted) {
    if (t.date > dateKey) break;
    if (t.type === 'buy') {
      totalCost += t.price * t.quantity;
      investedTotal += t.price * t.quantity;
      qty += t.quantity;
    } else {
      const avg = qty > 0 ? totalCost / qty : 0;
      const sellQty = Math.min(t.quantity, qty);
      realized += (t.price - avg) * sellQty;
      totalCost -= avg * sellQty;
      qty -= sellQty;
    }
  }
  const avgCost = qty > 0 ? totalCost / qty : 0;
  return { qty, avgCost, realized, investedTotal };
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const trades = body?.trades ?? {};
    const symbols = Object.keys(trades).filter((s) => Array.isArray(trades[s]) && trades[s].length > 0);

    if (symbols.length === 0) {
      return NextResponse.json({ points: [] } satisfies PortfolioHistoryResponse);
    }

    // Fetch 3-month daily history for each symbol in parallel
    const series: Record<string, SymbolSeries> = {};
    await Promise.all(
      symbols.map(async (s) => {
        const data = await fetchSymbolHistory(s, 90);
        if (data) series[s] = data;
      })
    );

    const validSymbols = Object.keys(series);
    if (validSymbols.length === 0) {
      return NextResponse.json({ points: [] } satisfies PortfolioHistoryResponse);
    }

    // Build the unified date axis (union of all symbols' trading days)
    const allDates = new Set<string>();
    for (const s of validSymbols) {
      series[s].prices.forEach((_, k) => allDates.add(k));
    }
    const dateAxis = Array.from(allDates).sort();

    // Earliest trade date — only build points from that day onwards
    let earliestTrade = '9999-99-99';
    for (const s of symbols) {
      for (const t of trades[s]) {
        if (t.date < earliestTrade) earliestTrade = t.date;
      }
    }

    const points: PortfolioPoint[] = [];
    // Track last-known price per symbol so missing bars (e.g. early-listed days) don't zero out
    const lastPrice: Record<string, number> = {};

    for (const dateKey of dateAxis) {
      if (dateKey < earliestTrade) continue;

      let value = 0;
      let totalInvested = 0;
      let totalRealized = 0;
      let anyHolding = false;

      for (const symbol of symbols) {
        const symSeries = series[symbol];
        if (symSeries) {
          const px = symSeries.prices.get(dateKey);
          if (px != null) lastPrice[symbol] = px;
        }
        const px = lastPrice[symbol];
        const pos = positionAt(trades[symbol], dateKey);

        if (pos.qty > 0 && px != null) {
          value += pos.qty * px;
          anyHolding = true;
        }
        totalInvested += pos.investedTotal;
        totalRealized += pos.realized;
      }

      if (totalInvested === 0 && !anyHolding) continue;

      const plAmount = (value + totalRealized) - totalInvested;
      const plPercent = totalInvested > 0 ? (plAmount / totalInvested) * 100 : 0;

      points.push({ date: dateKey, value, invested: totalInvested, plPercent, plAmount });
    }

    return NextResponse.json({ points } satisfies PortfolioHistoryResponse);
  } catch (e: any) {
    return NextResponse.json({ points: [], error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
