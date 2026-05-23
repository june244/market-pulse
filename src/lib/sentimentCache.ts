/**
 * Module-level cache shared between /api/sentiment (read-on-demand)
 * and /api/cron/snapshot (write nightly).
 */

import type { SentimentEntry } from './sentimentFetcher';
import { storeGet, storeSet } from './persistentStore';

const TTL_MS = 24 * 60 * 60 * 1000;
const TTL_SECONDS = TTL_MS / 1000;
const KEY_PREFIX = 'sentiment:cache';
const cache = new Map<string, { entry: SentimentEntry; expires: number }>();

export async function getCached(symbol: string): Promise<SentimentEntry | null> {
  const key = symbol.toUpperCase();
  const persisted = await storeGet<SentimentEntry>(`${KEY_PREFIX}:${key}`);
  if (persisted) {
    cache.set(key, { entry: persisted, expires: Date.now() + TTL_MS });
    return persisted;
  }

  const c = cache.get(key);
  if (c && c.expires > Date.now()) return c.entry;
  return null;
}

export async function setCached(symbol: string, entry: SentimentEntry): Promise<void> {
  const key = symbol.toUpperCase();
  cache.set(key, { entry, expires: Date.now() + TTL_MS });
  await storeSet(`${KEY_PREFIX}:${key}`, entry, TTL_SECONDS);
}
