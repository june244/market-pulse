/**
 * Server-side in-memory store for daily sentiment snapshots.
 *
 * - `/api/sentiment` records one entry per symbol per day on each cache-miss
 *   (TTL 24h ensures one snapshot per day per symbol).
 * - `/api/sentiment-history` reads accumulated snapshots for the detail modal.
 *
 * In-memory only — clears on server restart / redeploy (acceptable MVP).
 */

export interface DailySentimentSnapshot {
  date: string;            // YYYY-MM-DD (ET)
  symbol: string;
  redditMentions: number;
  redditScoreSum: number;
  analystMean: number | null;
  analystTotal: number;
}

import { storeGet, storeKeys, storeSet } from './persistentStore';

const SNAPSHOT_PREFIX = 'sentiment:snapshot';
const SEEN_TICKERS_KEY = 'sentiment:seenTickers';

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export async function recordSnapshot(s: Omit<DailySentimentSnapshot, 'date'> & { date?: string }): Promise<void> {
  const date = s.date ?? todayET();
  const key = `${SNAPSHOT_PREFIX}:${s.symbol}:${date}`;
  // Last write wins — useful if a re-fetch on the same day produces fresher data
  await storeSet(key, {
    date,
    symbol: s.symbol,
    redditMentions: s.redditMentions,
    redditScoreSum: s.redditScoreSum,
    analystMean: s.analystMean,
    analystTotal: s.analystTotal,
  });
}

export async function getSnapshotsFor(symbol: string, days = 30): Promise<DailySentimentSnapshot[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const keys = await storeKeys(`${SNAPSHOT_PREFIX}:${symbol.toUpperCase()}:*`);
  const result = (await Promise.all(keys.map((key) => storeGet<DailySentimentSnapshot>(key))))
    .filter((v): v is DailySentimentSnapshot => Boolean(v))
    .filter((v) => v.date >= cutoffStr);
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Seen-tickers registry (for nightly cron snapshot) ──
// Seeded with popular US stocks so the cron has something to snapshot on a fresh
// deploy. Custom user tickers get added the first time /api/sentiment is hit.
const POPULAR_DEFAULTS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'AMD', 'NFLX', 'AVGO', 'ORCL', 'CRM', 'COST', 'WMT',
  'JPM', 'V', 'MA', 'BAC', 'XOM', 'JNJ',
];

const seenTickers = new Set<string>(POPULAR_DEFAULTS);

async function loadSeenTickers(): Promise<Set<string>> {
  const saved = await storeGet<string[]>(SEEN_TICKERS_KEY);
  return new Set([...(saved ?? POPULAR_DEFAULTS), ...POPULAR_DEFAULTS].map((s) => s.toUpperCase()));
}

export async function recordSeenTicker(symbol: string): Promise<void> {
  const next = await loadSeenTickers();
  next.add(symbol.toUpperCase());
  seenTickers.add(symbol.toUpperCase());
  await storeSet(SEEN_TICKERS_KEY, Array.from(next));
}

export async function getSeenTickers(): Promise<string[]> {
  const saved = await loadSeenTickers();
  Array.from(saved).forEach((symbol) => seenTickers.add(symbol));
  return Array.from(seenTickers);
}
