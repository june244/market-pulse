import { NextResponse } from 'next/server';
import { DayScore, HistoryResponse } from '@/lib/types';
import { getSnapshots, backfillIfMissing } from '@/lib/historyStore';

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ── In-memory flag: only backfill from external APIs once per process ──
let backfilled = false;

function toETDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

async function fetchYahooChart(symbol: string): Promise<{ dates: string[]; closes: number[] }> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': YAHOO_UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return { dates: [], closes: [] };
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return { dates: [], closes: [] };

  const timestamps: number[] = result.timestamp ?? [];
  const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const dates: string[] = [];
  const closes: number[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (rawCloses[i] != null) {
      dates.push(toETDate(timestamps[i]));
      closes.push(rawCloses[i]!);
    }
  }
  return { dates, closes };
}

async function fetchFearGreedHistory(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        'User-Agent': YAHOO_UA,
        Accept: 'application/json',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return map;
    const data = await res.json();
    const points: { x: number; y: number }[] = data?.fear_and_greed_historical?.data ?? [];
    for (const pt of points) {
      const date = new Date(pt.x).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      map.set(date, Math.round(pt.y));
    }
  } catch (e) {
    console.error('F&G history fetch error:', e);
  }
  return map;
}

function computeChangePercents(closes: number[]): (number | null)[] {
  return closes.map((c, i) => {
    if (i === 0) return null;
    const prev = closes[i - 1];
    if (!prev) return null;
    return ((c - prev) / prev) * 100;
  });
}

function computeComposite(
  fg: number | null,
  vix: number | null,
  tnxChange: number | null,
  dxyChange: number | null,
): number {
  const entries: { weight: number; score: number }[] = [];
  if (fg != null) entries.push({ weight: 40, score: clamp(fg, 0, 100) });
  if (vix != null) {
    const normalized = 100 - ((clamp(vix, 10, 40) - 10) / 30) * 100;
    entries.push({ weight: 30, score: Math.round(normalized) });
  }
  if (tnxChange != null) {
    const normalized = 50 - (clamp(tnxChange, -3, 3) / 3) * 50;
    entries.push({ weight: 15, score: Math.round(normalized) });
  }
  if (dxyChange != null) {
    const normalized = 50 - (clamp(dxyChange, -2, 2) / 2) * 50;
    entries.push({ weight: 15, score: Math.round(normalized) });
  }
  if (entries.length === 0) return 50;
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  return clamp(
    Math.round(entries.reduce((s, e) => s + (e.score * e.weight) / totalWeight, 0)),
    0,
    100,
  );
}

/** Fetch external APIs once and backfill the shared store for past dates */
async function backfillFromAPIs() {
  if (backfilled) return;
  backfilled = true;

  try {
    const [fgMap, vixData, tnxData, dxyData] = await Promise.all([
      fetchFearGreedHistory(),
      fetchYahooChart('^VIX'),
      fetchYahooChart('^TNX'),
      fetchYahooChart('DX-Y.NYB'),
    ]);

    const vixMap = new Map<string, number>();
    for (let i = 0; i < vixData.dates.length; i++) {
      vixMap.set(vixData.dates[i], vixData.closes[i]);
    }

    const tnxChanges = computeChangePercents(tnxData.closes);
    const tnxMap = new Map<string, number>();
    for (let i = 0; i < tnxData.dates.length; i++) {
      if (tnxChanges[i] != null) tnxMap.set(tnxData.dates[i], tnxChanges[i]!);
    }

    const dxyChanges = computeChangePercents(dxyData.closes);
    const dxyMap = new Map<string, number>();
    for (let i = 0; i < dxyData.dates.length; i++) {
      if (dxyChanges[i] != null) dxyMap.set(dxyData.dates[i], dxyChanges[i]!);
    }

    // Backfill market-open dates (VIX = source of truth)
    for (const date of vixData.dates) {
      const fg = fgMap.get(date) ?? null;
      const vix = vixMap.get(date) ?? null;
      const tnxChange = tnxMap.get(date) ?? null;
      const dxyChange = dxyMap.get(date) ?? null;

      backfillIfMissing(date, {
        date,
        composite: computeComposite(fg, vix, tnxChange, dxyChange),
        fg,
        vix: vix != null ? Math.round(vix * 10) / 10 : null,
        tnxChange: tnxChange != null ? Math.round(tnxChange * 100) / 100 : null,
        dxyChange: dxyChange != null ? Math.round(dxyChange * 100) / 100 : null,
        marketOpen: true,
      });
    }
  } catch (e) {
    console.error('History backfill error:', e);
    // Allow retry on next request
    backfilled = false;
  }
}

export async function GET() {
  try {
    // Backfill from external APIs (once per server lifecycle)
    await backfillFromAPIs();

    const store = getSnapshots();

    // Build date range: 3 months ago (1st of month) → today
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setDate(1);

    const days: DayScore[] = [];
    const cursor = new Date(threeMonthsAgo);
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    while (cursor <= now) {
      const dateStr = cursor.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const saved = store.get(dateStr);

      if (saved) {
        days.push(saved);
      } else {
        // No data → market was closed (weekend/holiday)
        days.push({
          date: dateStr,
          composite: 50,
          fg: null,
          vix: null,
          tnxChange: null,
          dxyChange: null,
          marketOpen: false,
        });
      }

      if (dateStr === todayStr) break;
      cursor.setDate(cursor.getDate() + 1);
    }

    const response: HistoryResponse = {
      days,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (e: any) {
    console.error('History API error:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to fetch history' },
      { status: 500 },
    );
  }
}
