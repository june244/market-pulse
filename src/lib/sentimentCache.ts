/**
 * Module-level cache shared between /api/sentiment (read-on-demand)
 * and /api/cron/snapshot (write nightly).
 */

import type { SentimentEntry } from './sentimentFetcher';

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { entry: SentimentEntry; expires: number }>();

export function getCached(symbol: string): SentimentEntry | null {
  const c = cache.get(symbol);
  if (c && c.expires > Date.now()) return c.entry;
  return null;
}

export function setCached(symbol: string, entry: SentimentEntry): void {
  cache.set(symbol, { entry, expires: Date.now() + TTL_MS });
}
