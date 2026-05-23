import { NextRequest, NextResponse } from 'next/server';
import { fetchAndRecord, SentimentEntry } from '@/lib/sentimentFetcher';
import { getCached, setCached } from '@/lib/sentimentCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Re-export types so existing imports keep working
export type {
  SentimentEntry,
  AnalystConsensus,
  AnalystMonth,
  RedditPost,
} from '@/lib/sentimentFetcher';

export interface SentimentResponse {
  data: Record<string, SentimentEntry>;
  updatedAt: string;
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols') ?? '';
  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && /^[A-Z][A-Z0-9.\-^]{0,9}$/.test(s));

  if (symbols.length === 0) {
    return NextResponse.json({ data: {}, updatedAt: new Date().toISOString() } satisfies SentimentResponse);
  }

  const result: Record<string, SentimentEntry> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      const cached = await getCached(symbol);
      if (cached) {
        result[symbol] = cached;
        return;
      }
      const entry = await fetchAndRecord(symbol);
      await setCached(symbol, entry);
      result[symbol] = entry;
    })
  );

  return NextResponse.json({
    data: result,
    updatedAt: new Date().toISOString(),
  } satisfies SentimentResponse);
}
