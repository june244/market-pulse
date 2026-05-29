'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TickerData, Trade } from '@/lib/types';
import { formatNumber, formatVolume, formatMarketCap, loadTrades, saveTrades, calcPosition } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import TradeManager from './TradeManager';
import SentimentHistoryModal from './SentimentHistoryModal';

interface RedditPost {
  title: string;
  url: string;
  score: number;
  numComments: number;
  subreddit: string;
  createdUtc: number;
}

interface AnalystConsensus {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
  mean: number | null;
  key: string | null;
}

interface SentimentEntry {
  symbol: string;
  analyst: AnalystConsensus | null;
  reddit: { mentions: number; scoreSum: number; topPosts: RedditPost[] } | null;
  fetchedAt: string;
}

const PERIOD_KEYS = ['1M', '3M', '6M', '1Y'] as const;
const SWIPE_THRESHOLD = 80;
const SWIPE_LOCK_THRESHOLD = 10;

// Nordic palette: hi / up / dn / soft (Other)
const NORDIC_DONUT_COLORS = [
  'var(--accent-amber)',
  'var(--accent-green)',
  'var(--accent-red)',
  'var(--text-secondary)',
];

// --- Donut chart (Nordic FOLIO style: thin 5-stroke, 36 viewBox, r=14) ---
const DonutChart = React.memo(function DonutChart({
  segments,
}: {
  segments: { symbol: string; pct: number; color: string }[];
}) {
  const r = 14;
  const circ = 2 * Math.PI * r; // ≈88

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.pct / 100) * circ;
    const node = { ...seg, dash, offset: -cumulative };
    cumulative += dash;
    return node;
  });

  return (
    <svg width="80" height="80" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth="5" />
      {arcs.map((arc, i) => (
        <circle
          key={arc.symbol + i}
          cx="18" cy="18" r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="5"
          strokeDasharray={`${arc.dash} ${circ}`}
          strokeDashoffset={arc.offset}
          transform="rotate(-90 18 18)"
        />
      ))}
    </svg>
  );
});

// Analyst recommendationKey → "BUY"/"HOLD"/"SELL" + accent color
function analystLabel(a: AnalystConsensus): { label: string; color: string } | null {
  if (a.total === 0 && a.mean == null) return null;
  const m = a.mean;
  if (m != null) {
    if (m <= 1.8) return { label: 'STRONG BUY', color: 'var(--accent-green)' };
    if (m <= 2.5) return { label: 'BUY', color: 'var(--accent-green)' };
    if (m <= 3.4) return { label: 'HOLD', color: 'var(--accent-amber)' };
    if (m <= 4.2) return { label: 'SELL', color: 'var(--accent-red)' };
    return { label: 'STRONG SELL', color: 'var(--accent-red)' };
  }
  // Fallback: derive from counts
  const bull = a.strongBuy + a.buy;
  const bear = a.sell + a.strongSell;
  if (bull > bear * 1.5) return { label: 'BUY', color: 'var(--accent-green)' };
  if (bear > bull * 1.5) return { label: 'SELL', color: 'var(--accent-red)' };
  return { label: 'HOLD', color: 'var(--accent-amber)' };
}

// ── Compact analyst-vibe badge for collapsed row ──
function SentimentBadge({ entry }: { entry?: SentimentEntry }) {
  if (!entry?.analyst) return null;
  const label = analystLabel(entry.analyst);
  if (!label) return null;
  return (
    <span
      style={{
        marginLeft: '6px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '8px',
        letterSpacing: '0.1em',
        color: label.color,
      }}
    >
      · {label.label}
    </span>
  );
}

function relativeAge(unixSec: number): string {
  const diffMin = Math.max(0, (Date.now() / 1000 - unixSec) / 60);
  if (diffMin < 60) return `${Math.round(diffMin)}m`;
  const diffH = diffMin / 60;
  if (diffH < 24) return `${Math.round(diffH)}h`;
  return `${Math.round(diffH / 24)}d`;
}

// ── Full sentiment panel for expanded row ──
function SentimentPanel({
  entry, onOpenHistory,
}: {
  entry?: SentimentEntry;
  onOpenHistory?: () => void;
}) {
  if (!entry) return null;
  const an = entry.analyst;
  const rd = entry.reddit;
  const hasAny = (an && (an.total > 0 || an.mean != null)) || (rd && rd.mentions > 0);
  if (!hasAny) return null;

  const fetchedAge = entry.fetchedAt ? relativeAge(new Date(entry.fetchedAt).getTime() / 1000) : '?';

  return (
    <div style={{ paddingTop: '12px', borderTop: '1px solid var(--bg-tertiary)' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenHistory?.(); }}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: onOpenHistory ? 'pointer' : 'default',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '8px',
        }}
      >
        <span>Sentiment · 24h</span>
        <span>
          updated {fetchedAge} ago
          {onOpenHistory && <span style={{ marginLeft: '6px', color: 'var(--text-primary)' }}>view ›</span>}
        </span>
      </button>

      {an && an.total > 0 && (() => {
        const bull = an.strongBuy + an.buy;
        const hold = an.hold;
        const bear = an.sell + an.strongSell;
        const total = bull + hold + bear || 1;
        const bullPct = (bull / total) * 100;
        const holdPct = (hold / total) * 100;
        const bearPct = (bear / total) * 100;
        const lab = analystLabel(an);
        return (
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              <span>Analysts · {an.total} ratings</span>
              <span>
                <span style={{ color: 'var(--accent-green)' }}>BUY {bull}</span>
                {' / '}
                <span style={{ color: 'var(--accent-amber)' }}>HOLD {hold}</span>
                {' / '}
                <span style={{ color: 'var(--accent-red)' }}>SELL {bear}</span>
              </span>
            </div>
            <div style={{ display: 'flex', height: '6px', background: 'var(--bg-tertiary)' }}>
              <div style={{ width: `${bullPct}%`, background: 'var(--accent-green)' }} />
              <div style={{ width: `${holdPct}%`, background: 'var(--accent-amber)' }} />
              <div style={{ width: `${bearPct}%`, background: 'var(--accent-red)' }} />
            </div>
            {lab && an.mean != null && (
              <div
                style={{
                  marginTop: '4px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9px',
                  color: lab.color,
                  letterSpacing: '0.1em',
                }}
              >
                {lab.label} · mean {an.mean.toFixed(2)}/5
              </div>
            )}
          </div>
        );
      })()}

      {rd && rd.mentions > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            <span>Reddit</span>
            <span>{rd.mentions} mentions · {rd.scoreSum.toLocaleString()} upvotes</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {rd.topPosts.slice(0, 4).map((p) => (
              <a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto auto 1fr',
                  gap: '8px',
                  alignItems: 'baseline',
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--bg-tertiary)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '8px',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.08em',
                    minWidth: '64px',
                  }}
                >
                  r/{p.subreddit}
                </span>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '9px',
                    color: 'var(--accent-amber)',
                    minWidth: '36px',
                  }}
                >
                  {p.score >= 0 ? '+' : ''}{p.score.toLocaleString()}
                </span>
                <span style={{
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {p.title}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function splitDecimal(value: number): { int: string; dec: string } {
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formatted = (value < 0 ? '-' : '') + parseInt(intPart, 10).toLocaleString('en-US');
  return { int: formatted, dec: decPart };
}

// --- 2x2 stat cell (Nordic n-stats4) ---
function StatCell({
  k, v, color, big, borderRight, borderBottom,
}: {
  k: string;
  v: string;
  color?: string;
  big?: boolean;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  return (
    <div
      style={{
        padding: '10px 16px',
        borderRight: borderRight ? '1px solid var(--text-primary)' : undefined,
        borderBottom: borderBottom ? '1px solid var(--bg-tertiary)' : undefined,
      }}
    >
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '2px',
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontSize: big ? '20px' : '15px',
          fontWeight: 300,
          letterSpacing: '-0.01em',
          color: color ?? 'var(--text-primary)',
        }}
      >
        {v}
      </div>
    </div>
  );
}

function computeAnnualizedVol(sparkline?: number[]): number | null {
  if (!sparkline || sparkline.length < 6) return null;
  const returns: number[] = [];
  for (let i = 1; i < sparkline.length; i++) {
    const prev = sparkline[i - 1];
    const cur = sparkline[i];
    if (prev > 0 && cur > 0) returns.push((cur - prev) / prev);
  }
  if (returns.length < 5) return null;
  const avg = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(52) * 100;
}

function RiskSummaryPanel({
  risk,
}: {
  risk: {
    score: number;
    label: string;
    color: string;
    topHolding: { symbol: string; weight: number } | null;
    topThreeWeight: number;
    effectivePositions: number;
    highVolWeight: number;
    highVolSymbols: string[];
  };
}) {
  const bars = [
    { label: 'TOP 1', value: risk.topHolding?.weight ?? 0 },
    { label: 'TOP 3', value: risk.topThreeWeight },
    { label: 'HIGH VOL', value: risk.highVolWeight },
  ];

  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--text-primary)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}
        >
          Risk Exposure
        </div>
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: risk.color,
          }}
        >
          {risk.label} · {risk.score}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 40px', gap: '8px', alignItems: 'center' }}>
        {bars.map((bar) => (
          <React.Fragment key={bar.label}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '8px',
                letterSpacing: '0.14em',
                color: 'var(--text-secondary)',
              }}
            >
              {bar.label}
            </span>
            <div style={{ height: '6px', border: '1px solid var(--bg-tertiary)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, bar.value))}%`,
                  height: '100%',
                  background: bar.value >= 60 ? 'var(--accent-red)' : bar.value >= 40 ? 'var(--accent-amber)' : 'var(--text-primary)',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                textAlign: 'right',
                color: 'var(--text-primary)',
              }}
            >
              {formatNumber(bar.value, 0)}%
            </span>
          </React.Fragment>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '8px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          유효 종목수{' '}
          <b style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatNumber(risk.effectivePositions, 1)}</b>
        </span>
        <span style={{ textAlign: 'right' }}>
          {risk.topHolding ? `${risk.topHolding.symbol} ${formatNumber(risk.topHolding.weight, 0)}%` : '보유 없음'}
          {risk.highVolSymbols.length > 0 && (
            <span style={{ color: 'var(--accent-amber)' }}> · 변동 {risk.highVolSymbols.slice(0, 2).join('/')}</span>
          )}
        </span>
      </div>
    </div>
  );
}

// --- Day Range Bar ---
function DayRangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const { format } = useCurrency();
  const range = high - low || 1;
  const pct = Math.min(100, Math.max(0, ((current - low) / range) * 100));
  const upper = pct >= 50;

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[11px] font-display text-text-dim shrink-0">{format(low)}</span>
      <div className="flex-1 h-1.5 bg-bg-primary rounded-full relative overflow-hidden">
        <div className={`absolute inset-y-0 left-0 rounded-full ${upper ? 'bg-accent-green/40' : 'bg-accent-red/40'}`} style={{ width: `${pct}%` }} />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 ${upper ? 'bg-accent-green border-accent-green/30' : 'bg-accent-red border-accent-red/30'}`}
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
      <span className="text-[11px] font-display text-text-dim shrink-0">{format(high)}</span>
    </div>
  );
}

interface SwipeState {
  startX: number;
  startY: number;
  deltaX: number;
  locked: 'horizontal' | 'vertical' | null;
  active: boolean;
}

interface Props {
  tickers: TickerData[];
  loading: boolean;
  tickerOrder?: string[];
  onReorder?: (symbols: string[]) => void;
  onDelete?: (symbol: string) => void;
}

type WatchlistView = 'all' | 'tracking' | 'watching';

const CONFETTI_COLORS = ['#00ff87', '#ffd700', '#00aaff', '#ff3366', '#ffaa00'];

async function saveUserDataPatch(patch: Record<string, unknown>) {
  try {
    await fetch('/api/user-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch {
    // Local storage remains the offline fallback.
  }
}

function spawnConfetti(container: HTMLElement) {
  for (let i = 0; i < 20; i++) {
    const span = document.createElement('span');
    span.className = 'confetti-particle';
    span.style.left = `${Math.random() * 100}%`;
    span.style.top = `${Math.random() * 20 - 10}px`;
    span.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    span.style.animationDelay = `${Math.random() * 0.5}s`;
    span.style.width = `${4 + Math.random() * 4}px`;
    span.style.height = `${4 + Math.random() * 4}px`;
    container.appendChild(span);
    setTimeout(() => span.remove(), 2500);
  }
}

function TickerTable({ tickers, loading, tickerOrder, onReorder, onDelete }: Props) {
  const { currency, format } = useCurrency();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allTrades, setAllTrades] = useState<Record<string, Trade[]>>({});
  const [watchlistView, setWatchlistView] = useState<WatchlistView>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sentiments, setSentiments] = useState<Record<string, SentimentEntry>>({});
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);
  const celebratedRef = useRef<Set<string>>(new Set());

  // Drag state
  const [dragSymbol, setDragSymbol] = useState<string | null>(null);
  const [overSymbol, setOverSymbol] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragPointerId = useRef<number | null>(null);

  // Swipe state per row
  const swipeState = useRef<Map<string, SwipeState>>(new Map());
  const [swipeDeltas, setSwipeDeltas] = useState<Record<string, number>>({});
  const swipeDidAction = useRef<Set<string>>(new Set());

  useEffect(() => {
    const localTrades = loadTrades();
    setAllTrades(localTrades);

    let cancelled = false;
    fetch('/api/user-data', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((remote) => {
        if (cancelled || !remote) return;
        const remoteTrades = remote.trades && typeof remote.trades === 'object' ? remote.trades : {};
        if (Object.keys(remoteTrades).length > 0) {
          setAllTrades(remoteTrades);
          saveTrades(remoteTrades);
        } else if (Object.keys(localTrades).length > 0) {
          saveUserDataPatch({ trades: localTrades });
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // Fetch community sentiment for currently registered tickers (cached server-side 24h)
  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;
    const symbols = tickers.map((t) => t.symbol).join(',');
    fetch(`/api/sentiment?symbols=${encodeURIComponent(symbols)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data: Record<string, SentimentEntry> } | null) => {
        if (cancelled || !j?.data) return;
        setSentiments((prev) => ({ ...prev, ...j.data }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tickers.map((t) => t.symbol).join(',')]);

  // Sort tickers based on tickerOrder
  const sortedTickers = useMemo(() => tickerOrder
    ? [...tickers].sort((a, b) => {
        const ai = tickerOrder.indexOf(a.symbol);
        const bi = tickerOrder.indexOf(b.symbol);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
    : tickers, [tickers, tickerOrder]);

  const watchlistCounts = useMemo(() => {
    let tracking = 0;
    let watching = 0;
    for (const t of sortedTickers) {
      if ((allTrades[t.symbol] ?? []).length > 0) tracking++;
      else watching++;
    }
    return { all: sortedTickers.length, tracking, watching };
  }, [allTrades, sortedTickers]);

  const visibleTickers = useMemo(() => {
    if (watchlistView === 'all') return sortedTickers;
    return sortedTickers.filter((t) => {
      const hasTrades = (allTrades[t.symbol] ?? []).length > 0;
      return watchlistView === 'tracking' ? hasTrades : !hasTrades;
    });
  }, [allTrades, sortedTickers, watchlistView]);

  // Aggregate portfolio summary: totals + donut segments + trade stats
  const portfolioSummary = useMemo(() => {
    let totalInvested = 0;
    let totalUnrealized = 0;
    let totalRealized = 0;
    let totalValue = 0;
    let totalDailyChange = 0;
    let hasAny = false;

    type SymbolStat = { symbol: string; invested: number; currentValue: number; returnPct: number; vol: number | null };
    const symbolStats: SymbolStat[] = [];

    for (const t of sortedTickers) {
      const trades = allTrades[t.symbol];
      if (!trades || trades.length === 0) continue;
      const { avgCost, totalQty, realizedPL, investedAmount } = calcPosition(trades);
      if (totalQty > 0) {
        hasAny = true;
        const currentValue = t.price * totalQty;
        totalValue += currentValue;
        totalInvested += investedAmount;
        totalUnrealized += (t.price - avgCost) * totalQty;
        totalDailyChange += t.change * totalQty;
        const returnPct = avgCost > 0 ? ((t.price - avgCost) / avgCost) * 100 : 0;
        symbolStats.push({
          symbol: t.symbol,
          invested: investedAmount,
          currentValue,
          returnPct,
          vol: computeAnnualizedVol(t.sparkline),
        });
      }
      if (realizedPL !== 0) {
        hasAny = true;
        totalRealized += realizedPL;
      }
    }

    if (!hasAny) return null;

    const totalPL = totalUnrealized + totalRealized;
    const returnPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
    const prevValue = totalValue - totalDailyChange;
    const dailyChangePct = prevValue > 0 ? (totalDailyChange / prevValue) * 100 : 0;

    // Donut segments by current value, top-3 + Other (Nordic palette)
    const byValue = [...symbolStats].sort((a, b) => b.currentValue - a.currentValue);
    let segments: { symbol: string; pct: number; color: string }[];
    if (byValue.length <= 4) {
      segments = byValue.map((s, i) => ({
        symbol: s.symbol,
        pct: totalValue > 0 ? (s.currentValue / totalValue) * 100 : 0,
        color: NORDIC_DONUT_COLORS[i],
      }));
    } else {
      const top = byValue.slice(0, 3);
      const rest = byValue.slice(3);
      const restValue = rest.reduce((sum, s) => sum + s.currentValue, 0);
      segments = [
        ...top.map((s, i) => ({
          symbol: s.symbol,
          pct: totalValue > 0 ? (s.currentValue / totalValue) * 100 : 0,
          color: NORDIC_DONUT_COLORS[i],
        })),
        {
          symbol: 'Other',
          pct: totalValue > 0 ? (restValue / totalValue) * 100 : 0,
          color: NORDIC_DONUT_COLORS[3],
        },
      ];
    }

    // Win rate + best/worst (only among active positions)
    const wins = symbolStats.filter((s) => s.returnPct > 0).length;
    const winRate = symbolStats.length > 0 ? (wins / symbolStats.length) * 100 : 0;
    const best = symbolStats.length > 0
      ? symbolStats.reduce((b, s) => s.returnPct > b.returnPct ? s : b)
      : null;
    const worst = symbolStats.length > 0
      ? symbolStats.reduce((w, s) => s.returnPct < w.returnPct ? s : w)
      : null;

    const weights = symbolStats
      .map((s) => ({
        symbol: s.symbol,
        weight: totalValue > 0 ? (s.currentValue / totalValue) * 100 : 0,
        vol: s.vol,
      }))
      .sort((a, b) => b.weight - a.weight);
    const topHolding = weights[0] ? { symbol: weights[0].symbol, weight: weights[0].weight } : null;
    const topThreeWeight = weights.slice(0, 3).reduce((sum, w) => sum + w.weight, 0);
    const hhi = weights.reduce((sum, w) => sum + Math.pow(w.weight / 100, 2), 0);
    const effectivePositions = hhi > 0 ? 1 / hhi : 0;
    const highVol = weights.filter((w) => (w.vol ?? 0) >= 45);
    const highVolWeight = highVol.reduce((sum, w) => sum + w.weight, 0);

    const concentrationRisk = topHolding ? Math.max(0, (topHolding.weight - 25) * 1.2) : 0;
    const topThreeRisk = Math.max(0, (topThreeWeight - 60) * 0.7);
    const breadthRisk = Math.max(0, (4 - effectivePositions) * 8);
    const volatilityRisk = highVolWeight * 0.35;
    const riskScore = Math.round(Math.min(100, concentrationRisk + topThreeRisk + breadthRisk + volatilityRisk));
    const riskLevel = riskScore >= 70
      ? { label: 'High', color: 'var(--accent-red)' }
      : riskScore >= 40
        ? { label: 'Medium', color: 'var(--accent-amber)' }
        : { label: 'Balanced', color: 'var(--accent-green)' };

    return {
      totalValue, totalInvested, totalUnrealized, totalRealized, totalPL, returnPct,
      totalDailyChange, dailyChangePct,
      segments, wins, total: symbolStats.length, winRate, best, worst,
      risk: {
        score: riskScore,
        label: riskLevel.label,
        color: riskLevel.color,
        topHolding,
        topThreeWeight,
        effectivePositions,
        highVolWeight,
        highVolSymbols: highVol.map((w) => w.symbol),
      },
    };
  }, [allTrades, sortedTickers]);

  const toggle = (symbol: string) => {
    if (dragSymbol) return;
    if (swipeDidAction.current.has(symbol)) {
      swipeDidAction.current.delete(symbol);
      return;
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  // --- Drag handlers ---
  const handleDragStart = useCallback((symbol: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragPointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragSymbol(symbol);
    setOverSymbol(symbol);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragSymbol || e.pointerId !== dragPointerId.current) return;

    const y = e.clientY;
    let closest: string | null = null;
    let closestDist = Infinity;

    rowRefs.current.forEach((el, sym) => {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(y - mid);
      if (dist < closestDist) {
        closestDist = dist;
        closest = sym;
      }
    });

    if (closest) setOverSymbol(closest);
  }, [dragSymbol]);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragSymbol || e.pointerId !== dragPointerId.current) return;

    if (overSymbol && overSymbol !== dragSymbol && onReorder && tickerOrder) {
      const order = [...tickerOrder];
      const fromIdx = order.indexOf(dragSymbol);
      const toIdx = order.indexOf(overSymbol);
      if (fromIdx !== -1 && toIdx !== -1) {
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, dragSymbol);
        onReorder(order);
      }
    }

    setDragSymbol(null);
    setOverSymbol(null);
    dragPointerId.current = null;
  }, [dragSymbol, overSymbol, onReorder, tickerOrder]);

  // --- Swipe handlers ---
  const handleSwipePointerDown = useCallback((symbol: string, e: React.PointerEvent) => {
    if (dragSymbol) return;
    swipeState.current.set(symbol, {
      startX: e.clientX,
      startY: e.clientY,
      deltaX: 0,
      locked: null,
      active: true,
    });
  }, [dragSymbol]);

  const handleSwipePointerMove = useCallback((symbol: string, e: React.PointerEvent) => {
    const state = swipeState.current.get(symbol);
    if (!state || !state.active) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!state.locked) {
      if (Math.abs(dx) > SWIPE_LOCK_THRESHOLD) {
        state.locked = 'horizontal';
      } else if (Math.abs(dy) > SWIPE_LOCK_THRESHOLD) {
        state.locked = 'vertical';
        state.active = false;
        return;
      } else {
        return;
      }
    }

    if (state.locked !== 'horizontal') return;

    e.preventDefault();
    state.deltaX = dx;
    setSwipeDeltas((prev) => ({ ...prev, [symbol]: dx }));
  }, []);

  const handleSwipePointerUp = useCallback((symbol: string) => {
    const state = swipeState.current.get(symbol);
    if (!state || !state.active) {
      swipeState.current.delete(symbol);
      return;
    }

    const dx = state.deltaX;

    if (state.locked === 'horizontal' && Math.abs(dx) > SWIPE_LOCK_THRESHOLD) {
      swipeDidAction.current.add(symbol);
    }

    if (dx > SWIPE_THRESHOLD && onReorder && tickerOrder) {
      // Swipe right → pin to top
      const order = [...tickerOrder];
      const idx = order.indexOf(symbol);
      if (idx > 0) {
        order.splice(idx, 1);
        order.unshift(symbol);
        onReorder(order);
      }
    } else if (dx < -SWIPE_THRESHOLD) {
      // Swipe left → show delete confirmation
      setConfirmDelete(symbol);
    }

    // Snap back
    swipeState.current.delete(symbol);
    setSwipeDeltas((prev) => ({ ...prev, [symbol]: 0 }));
  }, [onReorder, tickerOrder]);

  const handleConfirmDelete = useCallback((symbol: string) => {
    setConfirmDelete(null);
    onDelete?.(symbol);
  }, [onDelete]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(null);
  }, []);

  // --- Trade handlers ---
  const handleAddTrade = useCallback((symbol: string, trade: Trade) => {
    setAllTrades((prev) => {
      const next = { ...prev, [symbol]: [...(prev[symbol] || []), trade] };
      saveTrades(next);
      saveUserDataPatch({ trades: next });
      return next;
    });
  }, []);

  const handleDeleteTrade = useCallback((symbol: string, tradeId: string) => {
    setAllTrades((prev) => {
      const next = { ...prev, [symbol]: (prev[symbol] || []).filter((t) => t.id !== tradeId) };
      if (next[symbol].length === 0) delete next[symbol];
      saveTrades(next);
      saveUserDataPatch({ trades: next });
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="opacity-0 animate-fade-in" style={{ borderTop: '1px solid var(--text-primary)' }}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: '44px',
              borderBottom: '1px solid var(--bg-tertiary)',
              background: 'var(--bg-tertiary)',
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    );
  }

  if (tickers.length === 0) {
    return (
      <div
        className="opacity-0 animate-fade-in"
        style={{ borderTop: '1px solid var(--text-primary)', padding: '40px 16px', textAlign: 'center' }}
      >
        <p
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}
        >
          티커를 추가해주세요
        </p>
      </div>
    );
  }

  const value = portfolioSummary ? splitDecimal(portfolioSummary.totalValue) : null;
  const dailyUp = portfolioSummary ? portfolioSummary.totalDailyChange >= 0 : true;
  const totalUp = portfolioSummary ? portfolioSummary.returnPct >= 0 : true;
  const viewLabel = watchlistView === 'tracking'
    ? 'Tracking'
    : watchlistView === 'watching'
      ? 'Watching'
      : 'Watchlist';
  const viewEmptyLabel = watchlistView === 'tracking'
    ? '거래 내역이 있는 종목이 없습니다'
    : watchlistView === 'watching'
      ? '관찰 중인 종목이 없습니다'
      : '티커를 추가해주세요';

  return (
    <div data-no-swipe className="opacity-0 animate-fade-in stagger-2">
      {/* ── Portfolio Value (n-perf) ── */}
      {portfolioSummary && value && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--text-primary)', borderBottom: '1px solid var(--text-primary)' }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Portfolio Value
          </div>
          <div style={{ fontSize: '36px', fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text-primary)' }}>
            {currency === 'USD' ? (
              <>
                ${value.int}
                <sup style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>.{value.dec}</sup>
              </>
            ) : (
              format(portfolioSummary.totalValue, { decimals: 0 })
            )}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '4px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
            }}
          >
            <span style={{ color: dailyUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {dailyUp ? '↗' : '↘'} {format(portfolioSummary.totalDailyChange, { signed: true })} ({dailyUp ? '+' : ''}{formatNumber(portfolioSummary.dailyChangePct)}%)
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              total {totalUp ? '+' : ''}{formatNumber(portfolioSummary.returnPct)}%
            </span>
          </div>
        </div>
      )}

      {/* ── Donut + legend (n-donut) ── */}
      {portfolioSummary && portfolioSummary.segments.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '14px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--text-primary)',
            alignItems: 'center',
          }}
        >
          <DonutChart segments={portfolioSummary.segments} />
          <div
            style={{
              flex: 1,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {portfolioSummary.segments.map((seg) => (
              <div
                key={seg.symbol}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}
              >
                <i style={{ width: '8px', height: '8px', background: seg.color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{seg.symbol}</span>
                <b style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatNumber(seg.pct, 0)}%</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats 2x2 (n-stats4) ── */}
      {portfolioSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--text-primary)' }}>
          <StatCell
            k="평가손익"
            v={format(portfolioSummary.totalPL, { signed: true })}
            color={portfolioSummary.totalPL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
            borderRight
            borderBottom
          />
          <StatCell
            k="수익률"
            v={`${portfolioSummary.returnPct >= 0 ? '+' : ''}${formatNumber(portfolioSummary.returnPct)}%`}
            color={portfolioSummary.returnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
            big
            borderBottom
          />
          <StatCell k="승률" v={`${portfolioSummary.wins} / ${portfolioSummary.total}`} borderRight />
          <StatCell k="투자원금" v={format(portfolioSummary.totalInvested)} />
        </div>
      )}

      {/* ── Extremes (n-extremes) ── */}
      {portfolioSummary && portfolioSummary.total > 1 && portfolioSummary.best && portfolioSummary.worst && (
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--text-primary)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            display: 'flex',
            gap: '16px',
          }}
        >
          <span>
            <span style={{ color: 'var(--text-secondary)' }}>최고 </span>
            <span style={{ color: portfolioSummary.best.returnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {portfolioSummary.best.symbol} {portfolioSummary.best.returnPct >= 0 ? '+' : ''}{formatNumber(portfolioSummary.best.returnPct)}%
            </span>
          </span>
          {portfolioSummary.worst.symbol !== portfolioSummary.best.symbol && (
            <span>
              <span style={{ color: 'var(--text-secondary)' }}>최악 </span>
              <span style={{ color: portfolioSummary.worst.returnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {portfolioSummary.worst.symbol} {portfolioSummary.worst.returnPct >= 0 ? '+' : ''}{formatNumber(portfolioSummary.worst.returnPct)}%
              </span>
            </span>
          )}
        </div>
      )}

      {portfolioSummary && (
        <RiskSummaryPanel risk={portfolioSummary.risk} />
      )}

      {/* ── Watchlist view switch ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '72px 1fr',
          borderBottom: '1px solid var(--text-primary)',
          minHeight: '84px',
        }}
      >
        <div
          style={{
            borderRight: '1px solid var(--text-primary)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {([
            { key: 'all' as const, label: 'All', count: watchlistCounts.all },
            { key: 'tracking' as const, label: 'Track', count: watchlistCounts.tracking },
            { key: 'watching' as const, label: 'Watch', count: watchlistCounts.watching },
          ]).map((item) => {
            const active = watchlistView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setWatchlistView(item.key)}
                style={{
                  flex: 1,
                  minHeight: '28px',
                  border: 'none',
                  borderBottom: item.key !== 'watching' ? '1px solid var(--bg-tertiary)' : undefined,
                  background: active ? 'var(--text-primary)' : 'transparent',
                  color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '8px',
                  letterSpacing: 0,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px',
                  padding: '0 7px',
                }}
                title={item.key === 'tracking' ? '거래 내역이 있는 종목' : item.key === 'watching' ? '거래 없이 관찰만 하는 종목' : '전체 등록 종목'}
              >
                <span>{item.label}</span>
                <span>{item.count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              letterSpacing: 0,
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            {viewLabel}
          </div>
          <div
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: '13px',
              color: 'var(--text-primary)',
              lineHeight: 1.35,
            }}
          >
            {watchlistView === 'tracking'
              ? '거래 내역이 있는 등록 종목만 봅니다.'
              : watchlistView === 'watching'
                ? '아직 거래를 입력하지 않은 관찰 종목입니다.'
                : '등록한 모든 종목입니다.'}
          </div>
        </div>
      </div>

      {/* ── Holdings table header (n-tbl hdr) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr auto auto',
          gap: '10px',
          padding: '6px 16px',
          borderBottom: '1px solid var(--text-secondary)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '8px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        <span>#</span>
        <span>{viewLabel}</span>
        <span style={{ textAlign: 'right' }}>Value</span>
        <span style={{ textAlign: 'right' }}>P/L</span>
      </div>

      <div
        onPointerMove={handlePointerMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        {visibleTickers.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              borderBottom: '1px solid var(--bg-tertiary)',
              textAlign: 'center',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              letterSpacing: 0,
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            {viewEmptyLabel}
          </div>
        )}
        {visibleTickers.map((t, i) => {
          const isUp = t.change >= 0;
          const isOpen = expanded.has(t.symbol);
          const symbolTrades = allTrades[t.symbol] || [];
          const pos = calcPosition(symbolTrades);
          const plPercent = pos.avgCost > 0 && pos.totalQty > 0 ? ((t.price - pos.avgCost) / pos.avgCost) * 100 : null;
          const plUp = plPercent !== null && plPercent >= 0;
          const positionValue = pos.totalQty > 0 ? t.price * pos.totalQty : null;
          const isDragging = dragSymbol === t.symbol;
          const isDropTarget = dragSymbol && overSymbol === t.symbol && overSymbol !== dragSymbol;
          const swipeDx = swipeDeltas[t.symbol] || 0;
          const showDeleteConfirm = confirmDelete === t.symbol;

          // Display column 4: P/L% if holding, else 24h change%
          const rightPct = plPercent !== null ? plPercent : t.changePercent;
          const rightUp = plPercent !== null ? plUp : isUp;

          // Sub-text: quantity + symbol if holding, else company name
          const subText = pos.totalQty > 0
            ? `${formatNumber(pos.totalQty, pos.totalQty % 1 === 0 ? 0 : 4)} ${t.symbol}`
            : t.symbol;

          return (
            <div
              key={t.symbol}
              ref={(el) => {
                if (el) {
                  rowRefs.current.set(t.symbol, el);
                  if (t.changePercent > 5 && !celebratedRef.current.has(t.symbol)) {
                    celebratedRef.current.add(t.symbol);
                    requestAnimationFrame(() => spawnConfetti(el));
                  }
                } else {
                  rowRefs.current.delete(t.symbol);
                }
              }}
              className={`relative transition-all duration-150 opacity-0 animate-slide-up ${
                isDragging ? 'opacity-50' : ''
              }`}
              style={{
                borderBottom: '1px solid var(--bg-tertiary)',
                animationDelay: `${0.3 + i * 0.05}s`,
                background: isDropTarget ? 'var(--bg-tertiary)' : undefined,
              }}
            >
              {showDeleteConfirm && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    background: 'rgba(255,122,106,0.08)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '10px',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: 'var(--accent-red)',
                    }}
                  >
                    삭제?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(t.symbol)}
                    style={{
                      padding: '5px 14px',
                      border: '1px solid var(--accent-red)',
                      background: 'var(--accent-red)',
                      color: 'var(--bg-primary)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '9px',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    style={{
                      padding: '5px 14px',
                      border: '1px solid var(--text-secondary)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '9px',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    취소
                  </button>
                </div>
              )}

              {!showDeleteConfirm && (
                <div className="relative">
                  {/* Swipe action indicators */}
                  <div
                    className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none transition-opacity"
                    style={{ opacity: swipeDx > SWIPE_LOCK_THRESHOLD ? Math.min(1, swipeDx / SWIPE_THRESHOLD) : 0 }}
                  >
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '9px',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--accent-amber)',
                      }}
                    >
                      Pin
                    </span>
                  </div>
                  <div
                    className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none transition-opacity"
                    style={{ opacity: swipeDx < -SWIPE_LOCK_THRESHOLD ? Math.min(1, Math.abs(swipeDx) / SWIPE_THRESHOLD) : 0 }}
                  >
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '9px',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--accent-red)',
                      }}
                    >
                      삭제
                    </span>
                  </div>

                  <div
                    className="relative touch-pan-y"
                    style={{
                      transform: swipeDx ? `translateX(${swipeDx}px)` : undefined,
                      transition: swipeDx ? 'none' : 'transform 0.2s ease-out',
                      background: 'var(--bg-primary)',
                    }}
                    onPointerDown={(e) => handleSwipePointerDown(t.symbol, e)}
                    onPointerMove={(e) => handleSwipePointerMove(t.symbol, e)}
                    onPointerUp={() => handleSwipePointerUp(t.symbol)}
                    onPointerCancel={() => handleSwipePointerUp(t.symbol)}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(t.symbol)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 1fr auto auto',
                        gap: '10px',
                        alignItems: 'center',
                        padding: '8px 16px',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {/* Index / drag handle */}
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '9px',
                          color: 'var(--text-secondary)',
                          cursor: 'grab',
                          touchAction: 'none',
                        }}
                        onPointerDown={(e) => { e.stopPropagation(); handleDragStart(t.symbol, e); }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>

                      {/* Holding name + sub */}
                      <div style={{ minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {t.name}
                        </span>
                        <small
                          style={{
                            display: 'block',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '8px',
                            fontWeight: 400,
                            color: 'var(--text-secondary)',
                            letterSpacing: '0.1em',
                            marginTop: '1px',
                          }}
                        >
                          {subText}
                          <SentimentBadge entry={sentiments[t.symbol]} />
                        </small>
                      </div>

                      {/* Value */}
                      <span
                        style={{
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {positionValue !== null ? format(positionValue) : format(t.price)}
                      </span>

                      {/* P/L% (or 24h change% if no position) */}
                      <span
                        style={{
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '10px',
                          color: rightUp ? 'var(--accent-green)' : 'var(--accent-red)',
                        }}
                      >
                        {rightUp ? '+' : ''}{formatNumber(rightPct)}%
                      </span>
                    </button>

                    {/* Expanded detail panel */}
                    <div
                      className={`transition-all duration-200 ease-out ${
                        isOpen ? 'max-h-[1200px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'
                      }`}
                      style={{ borderTop: isOpen ? '1px solid var(--bg-tertiary)' : undefined }}
                    >
                      <div className="px-4 pb-4 pt-3 space-y-3">
                        {/* Day Range Bar */}
                        <div>
                          <span className="text-[11px] text-text-dim font-display mb-1.5 block">일일 가격 범위</span>
                          <DayRangeBar low={t.dayLow} high={t.dayHigh} current={t.price} />
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                          <div>
                            <span className="text-[11px] text-text-dim font-display block mb-0.5">등락</span>
                            <span className={`text-sm font-display font-semibold ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
                              {format(t.change, { signed: true })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-text-dim font-display block mb-0.5">시가</span>
                            <span className="text-sm font-display font-medium text-text-primary">{format(t.open)}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-text-dim font-display block mb-0.5">전일 종가</span>
                            <span className="text-sm font-display font-medium text-text-primary">{format(t.prevClose)}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-text-dim font-display block mb-0.5">거래량</span>
                            <span className="text-sm font-display font-medium text-text-secondary">{formatVolume(t.volume)}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-text-dim font-display block mb-0.5">시가총액</span>
                            <span className="text-sm font-display font-medium text-text-primary">{formatMarketCap(t.marketCap)}</span>
                          </div>
                        </div>

                        {/* Period returns */}
                        {t.periodReturns && (
                          <div className="pt-3 border-t border-bg-tertiary/50">
                            <span className="text-[11px] text-text-dim font-display mb-2 block">기간 수익률</span>
                            <div className="grid grid-cols-4 gap-3">
                              {PERIOD_KEYS.map((key) => {
                                const ret = t.periodReturns?.[key];
                                if (!ret) {
                                  return (
                                    <div key={key} className="text-center">
                                      <span className="text-[11px] text-text-dim font-display block mb-1">{key}</span>
                                      <span className="text-xs font-display text-text-dim">—</span>
                                    </div>
                                  );
                                }
                                const up = ret.changePercent >= 0;
                                const barW = Math.min(100, Math.abs(ret.changePercent) * 1.5);
                                return (
                                  <div key={key} className="text-center">
                                    <span className="text-[11px] text-text-dim font-display block mb-1">{key}</span>
                                    <span className={`text-xs font-display font-bold ${up ? 'text-accent-green' : 'text-accent-red'}`}>
                                      {up ? '+' : ''}{formatNumber(ret.changePercent)}%
                                    </span>
                                    <div className="mt-1 h-1 bg-bg-primary rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${up ? 'bg-accent-green/60' : 'bg-accent-red/60'}`} style={{ width: `${barW}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Sentiment panel */}
                        <SentimentPanel
                          entry={sentiments[t.symbol]}
                          onOpenHistory={() => setHistorySymbol(t.symbol)}
                        />

                        {/* Trade manager */}
                        <TradeManager
                          symbol={t.symbol}
                          currentPrice={t.price}
                          trades={symbolTrades}
                          onAddTrade={handleAddTrade}
                          onDeleteTrade={handleDeleteTrade}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {historySymbol && (
        <SentimentHistoryModal
          symbol={historySymbol}
          onClose={() => setHistorySymbol(null)}
        />
      )}
    </div>
  );
}

export default React.memo(TickerTable);
