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

const store = new Map<string, DailySentimentSnapshot>();

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function recordSnapshot(s: Omit<DailySentimentSnapshot, 'date'> & { date?: string }) {
  const date = s.date ?? todayET();
  const key = `${date}|${s.symbol}`;
  // Last write wins — useful if a re-fetch on the same day produces fresher data
  store.set(key, {
    date,
    symbol: s.symbol,
    redditMentions: s.redditMentions,
    redditScoreSum: s.redditScoreSum,
    analystMean: s.analystMean,
    analystTotal: s.analystTotal,
  });
}

export function getSnapshotsFor(symbol: string, days = 30): DailySentimentSnapshot[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const result: DailySentimentSnapshot[] = [];
  store.forEach((v) => {
    if (v.symbol === symbol && v.date >= cutoffStr) result.push(v);
  });
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

export function recordSeenTicker(symbol: string): void {
  seenTickers.add(symbol.toUpperCase());
}

export function getSeenTickers(): string[] {
  return Array.from(seenTickers);
}
