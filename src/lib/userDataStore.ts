import { Trade } from './types';
import { Theme } from './utils';
import { storeGet, storeSet } from './persistentStore';

export interface UserData {
  tickers: string[];
  trades: Record<string, Trade[]>;
  costBasis: Record<string, number>;
  theme: Theme;
  updatedAt: string;
}

const KEY_PREFIX = 'user:data';

const EMPTY_USER_DATA: UserData = {
  tickers: [],
  trades: {},
  costBasis: {},
  theme: 'nordic',
  updatedAt: '',
};

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
