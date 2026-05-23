/**
 * Server-side in-memory store for daily market snapshots.
 *
 * - `/api/market` writes today's snapshot on every successful fetch.
 * - `/api/history` reads accumulated snapshots for the calendar heatmap.
 *
 * Data persists across requests within the same Node.js process
 * (cleared on server restart / redeploy).
 */

import { DayScore } from './types';
import { storeGet, storeKeys, storeSet } from './persistentStore';

const KEY_PREFIX = 'market:history';

function keyFor(date: string): string {
  return `${KEY_PREFIX}:${date}`;
}

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export interface DailySnapshot {
  fg: number | null;
  vix: number | null;
  tnxChange: number | null;
  dxyChange: number | null;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function computeComposite(s: DailySnapshot): number {
  const entries: { weight: number; score: number }[] = [];

  if (s.fg != null) {
    entries.push({ weight: 40, score: clamp(s.fg, 0, 100) });
  }
  if (s.vix != null) {
    const normalized = 100 - ((clamp(s.vix, 10, 40) - 10) / 30) * 100;
    entries.push({ weight: 30, score: Math.round(normalized) });
  }
  if (s.tnxChange != null) {
    const normalized = 50 - (clamp(s.tnxChange, -3, 3) / 3) * 50;
    entries.push({ weight: 15, score: Math.round(normalized) });
  }
  if (s.dxyChange != null) {
    const normalized = 50 - (clamp(s.dxyChange, -2, 2) / 2) * 50;
    entries.push({ weight: 15, score: Math.round(normalized) });
  }

  if (entries.length === 0) return 50;

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  const composite = Math.round(
    entries.reduce((sum, e) => sum + (e.score * e.weight) / totalWeight, 0),
  );
  return clamp(composite, 0, 100);
}

/** Called by /api/market on every successful fetch */
export async function recordSnapshot(snapshot: DailySnapshot): Promise<void> {
  const date = todayET();
  const composite = computeComposite(snapshot);
  await storeSet(keyFor(date), {
    date,
    composite,
    fg: snapshot.fg,
    vix: snapshot.vix != null ? Math.round(snapshot.vix * 10) / 10 : null,
    tnxChange: snapshot.tnxChange != null ? Math.round(snapshot.tnxChange * 100) / 100 : null,
    dxyChange: snapshot.dxyChange != null ? Math.round(snapshot.dxyChange * 100) / 100 : null,
    marketOpen: true,
  });
}

/** Called by /api/history — returns all stored snapshots */
export async function getSnapshots(): Promise<Map<string, DayScore>> {
  const result = new Map<string, DayScore>();
  const keys = await storeKeys(`${KEY_PREFIX}:*`);
  await Promise.all(
    keys.map(async (key) => {
      const day = await storeGet<DayScore>(key);
      if (day) result.set(day.date, day);
    }),
  );
  return result;
}

/** Merge external API data into store (fills missing dates, updates non-live entries) */
export async function backfillIfMissing(date: string, day: DayScore): Promise<void> {
  const existing = await storeGet<DayScore>(keyFor(date));
  if (!existing) {
    await storeSet(keyFor(date), day);
  } else if (!existing.marketOpen && day.marketOpen) {
    // Overwrite placeholder closed-day entry with real market data
    await storeSet(keyFor(date), day);
  }
}
