/**
 * Anomaly detection for daily push notifications.
 *
 * Run by /api/cron/snapshot after sentiment snapshots refresh.
 * Reads from sentimentCache (today's snapshot) + sentimentStore (history)
 * + a market data fetch.
 */

import { getCached } from './sentimentCache';
import { getSnapshotsFor } from './sentimentStore';
import type { SentimentEntry } from './sentimentFetcher';

export type Severity = 'HIGH' | 'MED' | 'LOW';

export interface Anomaly {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  symbol?: string;
  url?: string;
}

interface MarketSnapshot {
  fearGreed: { score: number; rating: string } | null;
  vix: { value: number; changePercent: number } | null;
  tickers: { symbol: string; changePercent: number }[];
}

interface TickerEvent {
  symbol: string;
  type: 'earnings' | 'exDividend' | 'dividend';
  date: string;
}

function daysBetween(target: Date, ref: Date): number {
  const a = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  return Math.round((a - b) / 86400000);
}

// In-memory anti-duplication: track which D-3 anomalies we already pushed.
const sentDMinus3 = new Map<string, string>(); // symbol → ISO date emitted

export async function detectAnomalies(input: {
  market: MarketSnapshot;
  events: TickerEvent[];
  yesterdayMarket?: { fearGreed?: { score: number; rating: string } | null; vix?: { value: number } | null } | null;
}): Promise<Anomaly[]> {
  const out: Anomaly[] = [];
  const now = new Date();

  // 1) Earnings D-1 / D-3
  for (const ev of input.events) {
    if (ev.type !== 'earnings') continue;
    const d = daysBetween(new Date(ev.date), now);
    if (d === 1) {
      out.push({
        id: `earn-d1-${ev.symbol}`,
        severity: 'HIGH',
        title: `${ev.symbol} 어닝 D-1`,
        body: `내일 ${ev.symbol} 실적 발표. 변동성 대비.`,
        symbol: ev.symbol,
      });
    } else if (d === 3) {
      const lastSent = sentDMinus3.get(ev.symbol);
      const todayKey = now.toISOString().slice(0, 10);
      if (lastSent !== todayKey) {
        sentDMinus3.set(ev.symbol, todayKey);
        out.push({
          id: `earn-d3-${ev.symbol}`,
          severity: 'MED',
          title: `${ev.symbol} 어닝 D-3`,
          body: `3일 후 ${ev.symbol} 어닝. 포지션 점검.`,
          symbol: ev.symbol,
        });
      }
    }
  }

  // 2) Analyst mean shift ±0.3 vs last week
  for (const t of input.market.tickers) {
    const cur: SentimentEntry | null = await getCached(t.symbol);
    if (!cur?.analyst?.mean) continue;
    const hist = await getSnapshotsFor(t.symbol, 14);
    // pick snapshot ~7 days ago
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const past = hist.filter((s) => s.date <= cutoffKey).pop();
    if (!past?.analystMean) continue;
    const delta = cur.analyst.mean - past.analystMean;
    if (Math.abs(delta) >= 0.3) {
      const dir = delta < 0 ? '상향' : '하향';
      out.push({
        id: `rating-${t.symbol}`,
        severity: 'HIGH',
        title: `${t.symbol} 분석가 등급 ${dir}`,
        body: `mean ${past.analystMean.toFixed(2)} → ${cur.analyst.mean.toFixed(2)}`,
        symbol: t.symbol,
      });
    }
  }

  // 3) Reddit mention spike — today's mentions vs 7-day avg × 2.5
  for (const t of input.market.tickers) {
    const cur = await getCached(t.symbol);
    const today = cur?.reddit?.mentions ?? 0;
    if (today < 5) continue;
    const hist = await getSnapshotsFor(t.symbol, 7);
    if (hist.length < 3) continue;
    const avg = hist.reduce((s, h) => s + h.redditMentions, 0) / hist.length;
    if (avg > 0 && today >= avg * 2.5) {
      out.push({
        id: `reddit-${t.symbol}`,
        severity: 'MED',
        title: `${t.symbol} Reddit 멘션 급증`,
        body: `오늘 ${today}건 (평균 ${avg.toFixed(0)}건의 ${(today / avg).toFixed(1)}배).`,
        symbol: t.symbol,
      });
    }
  }

  // 4) VIX spike — +15% or > 25
  const vix = input.market.vix;
  if (vix) {
    if (vix.changePercent >= 15) {
      out.push({
        id: 'vix-pop',
        severity: 'HIGH',
        title: `VIX 급등 +${vix.changePercent.toFixed(1)}%`,
        body: `현재 ${vix.value.toFixed(1)}. 변동성 확대.`,
      });
    } else if (vix.value >= 25) {
      out.push({
        id: 'vix-high',
        severity: 'HIGH',
        title: `VIX ${vix.value.toFixed(1)} 돌파`,
        body: `공포 구간 진입. 헤지 고려.`,
      });
    }
  }

  // 5) Fear & Greed zone shift
  const fg = input.market.fearGreed;
  const yFg = input.yesterdayMarket?.fearGreed;
  if (fg && yFg) {
    if (fg.rating !== yFg.rating) {
      out.push({
        id: 'fg-shift',
        severity: 'MED',
        title: `F&G ${yFg.rating} → ${fg.rating}`,
        body: `점수 ${yFg.score} → ${fg.score}. 시장 심리 전환.`,
      });
    }
  }

  // 6) Per-ticker daily move ±5%
  for (const t of input.market.tickers) {
    if (Math.abs(t.changePercent) >= 5) {
      out.push({
        id: `move-${t.symbol}`,
        severity: 'MED',
        title: `${t.symbol} ${t.changePercent >= 0 ? '+' : ''}${t.changePercent.toFixed(2)}%`,
        body: `${t.symbol} 일일 변동 ${Math.abs(t.changePercent).toFixed(1)}%.`,
        symbol: t.symbol,
      });
    }
  }

  return out;
}

export function highSeverity(list: Anomaly[]): Anomaly[] {
  return list.filter((a) => a.severity === 'HIGH');
}
