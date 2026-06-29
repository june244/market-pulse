import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserData, updateUserData, UserData } from '@/lib/userDataStore';
import { PositionLabel } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeSymbols(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((s) => String(s).trim().toUpperCase())
    .filter((s) => /^[A-Z][A-Z0-9.\-^]{0,9}$/.test(s));
}

function normalizePositionLabel(value: unknown): PositionLabel | null {
  switch (value) {
    case 'WATCH':
    case 'watch':
    case 'watchlist':
      return 'WATCH';
    case 'RESEARCH':
    case 'research':
      return 'RESEARCH';
    case 'GROWTH':
    case 'growth':
      return 'GROWTH';
    case 'CORE':
    case 'core':
      return 'CORE';
    case 'OVERWEIGHT':
    case 'overweight':
      return 'OVERWEIGHT';
    default:
      return null;
  }
}

function sanitizePositionLabels(value: unknown): Record<string, PositionLabel> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const labels: Record<string, PositionLabel> = {};
  for (const [rawSymbol, rawLabel] of Object.entries(value)) {
    const symbol = rawSymbol.trim().toUpperCase();
    const label = normalizePositionLabel(rawLabel);
    if (/^[A-Z][A-Z0-9.\-^]{0,9}$/.test(symbol) && label) {
      labels[symbol] = label;
    }
  }
  return labels;
}

async function requireEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email?.toLowerCase() ?? null;
}

export async function GET() {
  const email = await requireEmail();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(await getUserData(email));
}

export async function PUT(req: NextRequest) {
  const email = await requireEmail();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const patch: Partial<UserData> = {};

    const tickers = sanitizeSymbols(body?.tickers);
    if (tickers) patch.tickers = tickers;
    if (body?.trades && typeof body.trades === 'object') patch.trades = body.trades;
    if (body?.costBasis && typeof body.costBasis === 'object') patch.costBasis = body.costBasis;
    const positionLabels = sanitizePositionLabels(body?.positionLabels);
    if (positionLabels) patch.positionLabels = positionLabels;
    if (body?.cashBalance !== undefined) {
      const cashBalance = Number(body.cashBalance);
      if (Number.isFinite(cashBalance) && cashBalance >= 0) patch.cashBalance = cashBalance;
    }
    if (body?.theme === 'nordic' || body?.theme === 'nordic-light') patch.theme = body.theme;

    const next = await updateUserData(email, patch);
    return NextResponse.json(next);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'bad request' }, { status: 400 });
  }
}
