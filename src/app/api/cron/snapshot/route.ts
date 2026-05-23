import { NextRequest, NextResponse } from 'next/server';
import { fetchAndRecord } from '@/lib/sentimentFetcher';
import { setCached } from '@/lib/sentimentCache';
import { getSeenTickers } from '@/lib/sentimentStore';
import { generateBrief, setBriefCached, BriefInput, BriefEvent } from '@/lib/dailyBrief';
import { getCached } from '@/lib/sentimentCache';
import { detectAnomalies, highSeverity } from '@/lib/anomalyDetector';
import { sendPushToAll } from '@/lib/pushStore';
import { getSnapshots } from '@/lib/historyStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily snapshot cron.
 * 1. Refresh sentiment snapshots for tracked tickers.
 * 2. Generate Daily Brief via Claude Haiku.
 * 3. Detect anomalies; push HIGH severity ones to subscribers.
 */

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return unauthorized();
  }

  const symbols = await getSeenTickers();
  if (symbols.length === 0) {
    return NextResponse.json({ ok: true, snapshots: 0, symbols: [], note: 'no tickers tracked yet' });
  }

  // 1) Sentiment snapshots — sequential batches
  const results: { symbol: string; ok: boolean }[] = [];
  const BATCH = 4;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(async (sym) => {
        const entry = await fetchAndRecord(sym);
        await setCached(sym, entry);
        return sym;
      })
    );
    settled.forEach((r, idx) => {
      results.push({ symbol: batch[idx], ok: r.status === 'fulfilled' });
    });
  }

  // 2) Fetch market + ticker-events for brief + anomalies
  const origin = new URL(req.url).origin;
  const briefSymbols = symbols.slice(0, 12);
  const symParam = briefSymbols.join(',');
  const internalHeaders: Record<string, string> = {};
  if (process.env.AUTH_SECRET) internalHeaders['x-internal-key'] = process.env.AUTH_SECRET;
  const [marketRes, eventsRes] = await Promise.all([
    fetch(`${origin}/api/market?tickers=${encodeURIComponent(symParam)}`, { cache: 'no-store', headers: internalHeaders }),
    fetch(`${origin}/api/ticker-events?symbols=${encodeURIComponent(symParam)}`, { cache: 'no-store', headers: internalHeaders }),
  ]);
  const market = marketRes.ok ? await marketRes.json() : {};
  const events = eventsRes.ok ? await eventsRes.json() : { events: [] };

  // 3) Generate Daily Brief
  let briefOk = false;
  let briefError: string | null = null;
  try {
    const nowDayStart = startOfDayUTC(new Date());
    const upcomingEvents: BriefEvent[] = (events.events ?? [])
      .map((e: any) => {
        const evDay = startOfDayUTC(new Date(e.date));
        return { symbol: e.symbol, type: e.type, daysUntil: Math.round((evDay - nowDayStart) / 86400000) };
      })
      .filter((e: BriefEvent) => e.daysUntil >= 0 && e.daysUntil <= 3);

    const tickers = await Promise.all((market.tickers ?? []).map(async (t: any) => {
      const s = await getCached(t.symbol);
      return {
        symbol: t.symbol,
        changePercent: t.changePercent,
        analystMean: s?.analyst?.mean ?? null,
        redditMentions: s?.reddit?.mentions ?? null,
      };
    }));

    const input: BriefInput = {
      date: todayET(),
      fearGreed: market.fearGreed
        ? { score: market.fearGreed.score, rating: market.fearGreed.rating }
        : null,
      vix: market.vix
        ? { value: market.vix.value, changePercent: market.vix.changePercent }
        : null,
      macro: (market.macro ?? []).map((m: any) => ({ label: m.label, changePercent: m.changePercent })),
      tickers,
      upcomingEvents,
    };
    const brief = await generateBrief(input);
    await setBriefCached(input.date, brief);
    briefOk = true;
  } catch (e: any) {
    briefError = e?.message || 'brief generation failed';
  }

  // 4) Anomaly detection + push
  let pushSent = 0;
  let anomaliesFound = 0;
  let highCount = 0;
  let pushError: string | null = null;
  try {
    // Yesterday F&G from historyStore
    const yKey = (() => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return y.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    })();
    const yesterdayDay = (await getSnapshots()).get(yKey);
    const fgRating = (score: number | null): string => {
      if (score == null) return 'unknown';
      if (score <= 24) return 'extreme fear';
      if (score <= 44) return 'fear';
      if (score <= 55) return 'neutral';
      if (score <= 74) return 'greed';
      return 'extreme greed';
    };
    const yesterdayMarket = yesterdayDay?.fg != null
      ? { fearGreed: { score: yesterdayDay.fg, rating: fgRating(yesterdayDay.fg) } }
      : null;

    const anomalies = await detectAnomalies({
      market: {
        fearGreed: market.fearGreed ?? null,
        vix: market.vix ?? null,
        tickers: (market.tickers ?? []).map((t: any) => ({ symbol: t.symbol, changePercent: t.changePercent })),
      },
      events: events.events ?? [],
      yesterdayMarket,
    });
    anomaliesFound = anomalies.length;

    const highs = highSeverity(anomalies);
    highCount = highs.length;
    if (highs.length > 0) {
      // Combine into one push if multiple, to avoid spamming
      const first = highs[0];
      const extra = highs.length > 1 ? ` 외 ${highs.length - 1}건` : '';
      try {
        const result = await sendPushToAll({
          title: first.title + extra,
          body: highs.map((a) => `· ${a.body}`).join('\n').slice(0, 300),
          url: '/',
          tag: `daily-${todayET()}`,
          severity: 'HIGH',
        });
        pushSent = result.sent;
      } catch (e: any) {
        pushError = e?.message || 'push failed';
      }
    }
  } catch (e: any) {
    pushError = e?.message || 'anomaly detection failed';
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    snapshots: okCount,
    failed: results.length - okCount,
    symbols: results.map((r) => r.symbol),
    brief: { ok: briefOk, error: briefError },
    anomalies: { total: anomaliesFound, high: highCount, pushSent, error: pushError },
    runAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
