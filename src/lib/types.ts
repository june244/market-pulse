export interface FearGreedData {
  score: number;
  rating: string;
  timestamp: string | null;
}

export interface VIXData {
  value: number;
  change: number;
  changePercent: number;
}

export interface PeriodReturn {
  price: number;
  changePercent: number;
}

export interface PeriodReturns {
  '1M': PeriodReturn | null;
  '3M': PeriodReturn | null;
  '6M': PeriodReturn | null;
  '1Y': PeriodReturn | null;
}

export interface TickerData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  prevClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: number;
  marketState: string;
  periodReturns?: PeriodReturns;
  sparkline?: number[];
}

export interface MacroItem {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface MarketData {
  fearGreed: FearGreedData | null;
  vix: VIXData | null;
  macro: MacroItem[];
  tickers: TickerData[];
  updatedAt: string;
}

export type SentimentLevel = 'extreme-fear' | 'fear' | 'neutral' | 'greed' | 'extreme-greed';

export interface DayScore {
  date: string;            // "YYYY-MM-DD" (ET timezone)
  composite: number;       // 0-100
  fg: number | null;       // Fear & Greed raw score
  vix: number | null;      // VIX closing price
  tnxChange: number | null; // 10Y 금리 일간 변화%
  dxyChange: number | null; // DXY 일간 변화%
  marketOpen: boolean;
}

export interface HistoryResponse {
  days: DayScore[];
  updatedAt: string;
}
