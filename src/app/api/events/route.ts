import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FFEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

export interface CalendarEvent {
  date: string;        // ISO datetime in original tz offset
  dateKey: string;     // YYYY-MM-DD in ET (matches DayScore.date)
  title: string;
  country: string;
  impact: 'High' | 'Medium';
}

export interface EventsResponse {
  events: CalendarEvent[];
  updatedAt: string;
}

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const ALLOWED_COUNTRIES = new Set(['USD', 'EUR', 'JPY', 'GBP', 'CNY']);

let cache: { data: EventsResponse; expires: number } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchFF(url: string): Promise<FFEvent[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 MarketPulse' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  return res.json();
}

function dateKeyET(iso: string): string {
  // FF dates are in ET (-04:00 EDT or -05:00 EST). Extract local date directly.
  return iso.slice(0, 10);
}

export async function GET() {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return NextResponse.json(cache.data);
  }

  try {
    const raw = await fetchFF(FF_URL).catch(() => []);

    const all = raw
      .filter((e) => (e.impact === 'High' || e.impact === 'Medium') && ALLOWED_COUNTRIES.has(e.country))
      .map((e): CalendarEvent => ({
        date: e.date,
        dateKey: dateKeyET(e.date),
        title: e.title,
        country: e.country,
        impact: e.impact as 'High' | 'Medium',
      }));

    // De-duplicate (FF feeds sometimes overlap on the boundary day)
    const seen = new Set<string>();
    const events = all.filter((e) => {
      const key = `${e.date}|${e.title}|${e.country}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    events.sort((a, b) => a.date.localeCompare(b.date));

    const data: EventsResponse = { events, updatedAt: new Date().toISOString() };
    cache = { data, expires: now + CACHE_MS };
    return NextResponse.json(data);
  } catch (err) {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ events: [], updatedAt: new Date().toISOString() } satisfies EventsResponse);
  }
}
