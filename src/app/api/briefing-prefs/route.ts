import { NextRequest, NextResponse } from 'next/server';
import { getBriefingPrefs, setBriefingPrefs, BriefingPrefs, NARRATIVE_OPTIONS, NarrativeTag } from '@/lib/briefingPrefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const prefs = await getBriefingPrefs();
  return NextResponse.json({ ...prefs, narrativeOptions: NARRATIVE_OPTIONS });
}

const VALID = new Set<string>(NARRATIVE_OPTIONS);

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const philosophy = typeof body?.philosophy === 'string' ? body.philosophy : '';
    const narratives: BriefingPrefs['narratives'] = {};

    if (body?.narratives && typeof body.narratives === 'object') {
      for (const [rawSym, raw] of Object.entries(body.narratives as Record<string, any>)) {
        if (!rawSym) continue;
        const sym = String(rawSym).toUpperCase().trim();
        if (!sym) continue;
        const tag: string = raw?.narrative ?? '기타';
        if (!VALID.has(tag)) continue;
        narratives[sym] = {
          narrative: tag as NarrativeTag,
          thesis: typeof raw?.thesis === 'string' ? raw.thesis : undefined,
          monitoring: typeof raw?.monitoring === 'string' ? raw.monitoring : undefined,
        };
      }
    }

    await setBriefingPrefs({ philosophy, narratives });
    const updated = await getBriefingPrefs();
    return NextResponse.json({ ok: true, prefs: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'bad request' }, { status: 400 });
  }
}
