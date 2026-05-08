import { NextRequest, NextResponse } from 'next/server';
import { getYahooCrumb, YAHOO_UA } from '@/lib/yahooAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type TickerEventType = 'earnings' | 'exDividend' | 'dividend';

export interface TickerEvent {
  symbol: string;
  type: TickerEventType;
  date: string;        // ISO datetime
  dateKey: string;     // YYYY-MM-DD (ET)
  label: string;       // "AAPL · Earnings"
  estimate?: number | null;  // EPS estimate (earnings only)
}

export interface TickerEventsResponse {
  events: TickerEvent[];
  updatedAt: string;
}

// 6-hour cache per symbol
const cache = new Map<string, { events: TickerEvent[]; expires: number }>();
const TTL_MS = 6 * 60 * 60 * 1000;

function tsToETDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Yahoo encodes date-only events (dividends, ex-div) as UTC-midnight unix timestamps.
// ET conversion of UTC-midnight shifts the date one day back, so for those we
// extract the UTC calendar date directly.
function tsToDateOnly(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

async function fetchOne(symbol: string): Promise<TickerEvent[]> {
  try {
    const { crumb, cookies } = await getYahooCrumb();
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents&crumb=${encodeURIComponent(crumb)}`;
    let res = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, Cookie: cookies },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) {
      const fresh = await getYahooCrumb(true);
      const retryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents&crumb=${encodeURIComponent(fresh.crumb)}`;
      res = await fetch(retryUrl, {
        headers: { 'User-Agent': YAHOO_UA, Cookie: fresh.cookies },
        signal: AbortSignal.timeout(8000),
      });
    }
    if (!res.ok) return [];
    const json = await res.json();
    const cal = json?.quoteSummary?.result?.[0]?.calendarEvents;
    if (!cal) return [];

    const events: TickerEvent[] = [];

    // Earnings — earningsDate is array (often a date range, take first)
    const earningsDates: any[] = cal.earnings?.earningsDate ?? [];
    if (earningsDates.length > 0) {
      const ts = earningsDates[0]?.raw;
      if (ts) {
        events.push({
          symbol,
          type: 'earnings',
          date: new Date(ts * 1000).toISOString(),
          dateKey: tsToETDate(ts),
          label: `${symbol} · Earnings`,
          estimate: cal.earnings?.earningsAverage?.raw ?? null,
        });
      }
    }

    // Ex-dividend (date-only)
    const exDiv = cal.exDividendDate?.raw;
    if (exDiv) {
      events.push({
        symbol,
        type: 'exDividend',
        date: new Date(exDiv * 1000).toISOString(),
        dateKey: tsToDateOnly(exDiv),
        label: `${symbol} · Ex-Div`,
      });
    }

    // Dividend payment (date-only)
    const divPay = cal.dividendDate?.raw;
    if (divPay) {
      events.push({
        symbol,
        type: 'dividend',
        date: new Date(divPay * 1000).toISOString(),
        dateKey: tsToDateOnly(divPay),
        label: `${symbol} · Div Pay`,
      });
    }

    return events;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols') ?? '';
  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && /^[A-Z][A-Z0-9.\-^]{0,9}$/.test(s));

  if (symbols.length === 0) {
    return NextResponse.json({ events: [], updatedAt: new Date().toISOString() } satisfies TickerEventsResponse);
  }

  const now = Date.now();
  const all: TickerEvent[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      const cached = cache.get(symbol);
      if (cached && cached.expires > now) {
        all.push(...cached.events);
        return;
      }
      const events = await fetchOne(symbol);
      cache.set(symbol, { events, expires: now + TTL_MS });
      all.push(...events);
    })
  );

  // Sort by date ascending
  all.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    events: all,
    updatedAt: new Date().toISOString(),
  } satisfies TickerEventsResponse);
}
