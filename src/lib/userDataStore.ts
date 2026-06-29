import { PositionLabel, Trade } from './types';
import { Theme } from './utils';
import { storeGet, storeSet } from './persistentStore';

export interface UserData {
  tickers: string[];
  trades: Record<string, Trade[]>;
  costBasis: Record<string, number>;
  positionLabels: Record<string, PositionLabel>;
  cashBalance: number;
  theme: Theme;
  updatedAt: string;
}

const KEY_PREFIX = 'user:data';

const EMPTY_USER_DATA: UserData = {
  tickers: [],
  trades: {},
  costBasis: {},
  positionLabels: {},
  cashBalance: 0,
  theme: 'nordic',
  updatedAt: '',
};

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

function cleanPositionLabels(value: unknown): Record<string, PositionLabel> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
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

function keyFor(email: string): string {
  return `${KEY_PREFIX}:${email.toLowerCase()}`;
}

export async function getUserData(email: string): Promise<UserData> {
  const saved = await storeGet<Partial<UserData>>(keyFor(email));
  return {
    ...EMPTY_USER_DATA,
    ...saved,
    tickers: Array.isArray(saved?.tickers) ? saved.tickers : [],
    trades: saved?.trades && typeof saved.trades === 'object' ? saved.trades : {},
    costBasis: saved?.costBasis && typeof saved.costBasis === 'object' ? saved.costBasis : {},
    positionLabels: cleanPositionLabels(saved?.positionLabels),
    cashBalance: typeof saved?.cashBalance === 'number' && Number.isFinite(saved.cashBalance) && saved.cashBalance > 0 ? saved.cashBalance : 0,
    theme: saved?.theme === 'nordic-light' ? 'nordic-light' : 'nordic',
    updatedAt: saved?.updatedAt ?? '',
  };
}

export async function updateUserData(email: string, patch: Partial<UserData>): Promise<UserData> {
  const current = await getUserData(email);
  const next: UserData = {
    ...current,
    ...patch,
    theme: patch.theme === 'nordic-light' ? 'nordic-light' : patch.theme === 'nordic' ? 'nordic' : current.theme,
    updatedAt: new Date().toISOString(),
  };
  await storeSet(keyFor(email), next);
  return next;
}
