import { SentimentLevel, Trade } from './types';

export function getSentimentLevel(score: number): SentimentLevel {
  if (score <= 20) return 'extreme-fear';
  if (score <= 40) return 'fear';
  if (score <= 60) return 'neutral';
  if (score <= 80) return 'greed';
  return 'extreme-greed';
}

export function getSentimentLabel(level: SentimentLevel): string {
  const labels: Record<SentimentLevel, string> = {
    'extreme-fear': 'Extreme Fear',
    'fear': 'Fear',
    'neutral': 'Neutral',
    'greed': 'Greed',
    'extreme-greed': 'Extreme Greed',
  };
  return labels[level];
}

export function getSentimentLabelKR(level: SentimentLevel): string {
  const labels: Record<SentimentLevel, string> = {
    'extreme-fear': '극도의 공포',
    'fear': '공포',
    'neutral': '중립',
    'greed': '탐욕',
    'extreme-greed': '극도의 탐욕',
  };
  return labels[level];
}

export function getSentimentColor(level: SentimentLevel): string {
  const colors: Record<SentimentLevel, string> = {
    'extreme-fear': '#ff3366',
    'fear': '#ff6644',
    'neutral': '#ffaa00',
    'greed': '#88cc44',
    'extreme-greed': '#00ff87',
  };
  return colors[level];
}

export function getVIXLevel(value: number): { label: string; labelKR: string; color: string } {
  if (value < 12) return { label: 'Low', labelKR: '낮음', color: '#00ff87' };
  if (value < 20) return { label: 'Normal', labelKR: '보통', color: '#ffaa00' };
  if (value < 30) return { label: 'Elevated', labelKR: '높음', color: '#ff6644' };
  return { label: 'Extreme', labelKR: '극단적', color: '#ff3366' };
}

export function formatNumber(num: number, decimals = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

export function formatMarketCap(cap: number): string {
  if (cap >= 1_000_000_000_000) return `$${(cap / 1_000_000_000_000).toFixed(2)}T`;
  if (cap >= 1_000_000_000) return `$${(cap / 1_000_000_000).toFixed(1)}B`;
  if (cap >= 1_000_000) return `$${(cap / 1_000_000).toFixed(1)}M`;
  return `$${cap.toLocaleString()}`;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DEFAULT_TICKERS: string[] = [];

export function loadTickers(): string[] {
  if (typeof window === 'undefined') return DEFAULT_TICKERS;
  try {
    const saved = localStorage.getItem('market-pulse-tickers');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_TICKERS;
}

export function saveTickers(tickers: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('market-pulse-tickers', JSON.stringify(tickers));
}

// Cost basis (average unit price) per symbol — saved per device
const COST_BASIS_KEY = 'market-pulse-cost-basis';

export function loadCostBasis(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(COST_BASIS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

export function saveCostBasis(costBasis: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COST_BASIS_KEY, JSON.stringify(costBasis));
}

// Trades per symbol — saved per device
const TRADES_KEY = 'market-pulse-trades';

export function loadTrades(): Record<string, Trade[]> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(TRADES_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  // Migration: convert old cost basis to a single buy trade
  try {
    const oldBasis = localStorage.getItem(COST_BASIS_KEY);
    if (oldBasis) {
      const parsed: Record<string, number> = JSON.parse(oldBasis);
      const trades: Record<string, Trade[]> = {};
      for (const [symbol, price] of Object.entries(parsed)) {
        if (price > 0) {
          trades[symbol] = [{
            id: crypto.randomUUID(),
            type: 'buy',
            date: new Date().toISOString().slice(0, 10),
            price,
            quantity: 1,
          }];
        }
      }
      if (Object.keys(trades).length > 0) {
        localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
        return trades;
      }
    }
  } catch {}
  return {};
}

export function saveTrades(trades: Record<string, Trade[]>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
}

export function calcPosition(trades: Trade[]): {
  avgCost: number;
  totalQty: number;
  realizedPL: number;
  investedAmount: number;
} {
  let totalQty = 0;
  let totalCost = 0;
  let realizedPL = 0;

  // Process trades in date order
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const trade of sorted) {
    if (trade.type === 'buy') {
      totalCost += trade.price * trade.quantity;
      totalQty += trade.quantity;
    } else {
      // sell
      const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
      const sellQty = Math.min(trade.quantity, totalQty);
      realizedPL += (trade.price - avgCost) * sellQty;
      totalCost -= avgCost * sellQty;
      totalQty -= sellQty;
    }
  }

  const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
  return { avgCost, totalQty, realizedPL, investedAmount: totalCost };
}

// Theme persistence
const THEME_KEY = 'market-pulse-theme';
export type Theme = 'dark' | 'light' | 'oled' | 'bloomberg';

export function loadTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && ['dark', 'light', 'oled', 'bloomberg'].includes(saved)) return saved as Theme;
  } catch {}
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
}
