'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TickerData } from '@/lib/types';
import { formatNumber, formatVolume, formatMarketCap, loadCostBasis, saveCostBasis } from '@/lib/utils';

const PERIOD_KEYS = ['1M', '3M', '6M', '1Y'] as const;

// --- Sparkline SVG ---
function Sparkline({ data, width = 80, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? '#00ff87' : '#ff3366';
  const lastPt = points[points.length - 1].split(',');
  const firstX = pad;
  const lastX = pad + (width - pad * 2);
  const area = `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(' ')} L${lastX},${height} L${firstX},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${isUp ? 'u' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${isUp ? 'u' : 'd'})`} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={parseFloat(lastPt[0])} cy={parseFloat(lastPt[1])} r={2} fill={color} />
    </svg>
  );
}

// --- Day Range Bar ---
function DayRangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const range = high - low || 1;
  const pct = Math.min(100, Math.max(0, ((current - low) / range) * 100));
  const upper = pct >= 50;

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[11px] font-display text-text-dim shrink-0">${formatNumber(low)}</span>
      <div className="flex-1 h-1.5 bg-bg-primary rounded-full relative overflow-hidden">
        <div className={`absolute inset-y-0 left-0 rounded-full ${upper ? 'bg-accent-green/40' : 'bg-accent-red/40'}`} style={{ width: `${pct}%` }} />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 ${upper ? 'bg-accent-green border-accent-green/30' : 'bg-accent-red border-accent-red/30'}`}
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
      <span className="text-[11px] font-display text-text-dim shrink-0">${formatNumber(high)}</span>
    </div>
  );
}

// --- Drag handle icon ---
function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" className="text-text-dim">
      <circle cx="2" cy="2" r="1.2" />
      <circle cx="8" cy="2" r="1.2" />
      <circle cx="2" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="2" cy="14" r="1.2" />
      <circle cx="8" cy="14" r="1.2" />
    </svg>
  );
}

interface Props {
  tickers: TickerData[];
  loading: boolean;
  tickerOrder?: string[];
  onReorder?: (symbols: string[]) => void;
}

export default function TickerTable({ tickers, loading, tickerOrder, onReorder }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [costBasis, setCostBasis] = useState<Record<string, number>>({});
  const [editingCost, setEditingCost] = useState<Record<string, string>>({});

  // Drag state
  const [dragSymbol, setDragSymbol] = useState<string | null>(null);
  const [overSymbol, setOverSymbol] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragPointerId = useRef<number | null>(null);

  useEffect(() => {
    setCostBasis(loadCostBasis());
  }, []);

  // Sort tickers based on tickerOrder
  const sortedTickers = tickerOrder
    ? [...tickers].sort((a, b) => {
        const ai = tickerOrder.indexOf(a.symbol);
        const bi = tickerOrder.indexOf(b.symbol);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
    : tickers;

  const toggle = (symbol: string) => {
    if (dragSymbol) return; // don't toggle during drag
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

    // Find which row the pointer is over
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

  // --- Cost basis handlers ---
  const handleCostChange = (symbol: string, value: string) => {
    setEditingCost((prev) => ({ ...prev, [symbol]: value }));
  };

  const handleCostSave = (symbol: string) => {
    const raw = editingCost[symbol];
    if (raw === undefined) return;
    const num = parseFloat(raw);
    const next = { ...costBasis };
    if (!raw || isNaN(num) || num <= 0) {
      delete next[symbol];
    } else {
      next[symbol] = num;
    }
    setCostBasis(next);
    saveCostBasis(next);
    setEditingCost((prev) => {
      const copy = { ...prev };
      delete copy[symbol];
      return copy;
    });
  };

  const getEditValue = (symbol: string): string => {
    if (symbol in editingCost) return editingCost[symbol];
    if (costBasis[symbol]) return costBasis[symbol].toString();
    return '';
  };

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-6 card-hover">
        <div className="h-6 w-40 bg-bg-tertiary rounded mb-4 animate-pulse" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 bg-bg-tertiary rounded-lg mb-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (tickers.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-6 card-hover">
        <h2 className="font-display text-sm font-medium tracking-wider text-text-secondary uppercase mb-4">
          Watchlist
        </h2>
        <p className="text-text-secondary text-sm">티커를 추가해주세요</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-2xl p-6 card-hover opacity-0 animate-fade-in stagger-2">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-sm font-medium tracking-wider text-text-secondary uppercase">
          Watchlist
        </h2>
        <span className="text-xs text-text-secondary font-display">
          {tickers[0]?.marketState === 'REGULAR' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-slow" />
              LIVE
            </span>
          ) : (
            'CLOSED'
          )}
        </span>
      </div>

      <div
        className="space-y-1.5"
        onPointerMove={handlePointerMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        {sortedTickers.map((t, i) => {
          const isUp = t.change >= 0;
          const isOpen = expanded.has(t.symbol);
          const basis = costBasis[t.symbol];
          const plPercent = basis ? ((t.price - basis) / basis) * 100 : null;
          const plUp = plPercent !== null && plPercent >= 0;
          const isDragging = dragSymbol === t.symbol;
          const isDropTarget = dragSymbol && overSymbol === t.symbol && overSymbol !== dragSymbol;

          return (
            <div
              key={t.symbol}
              ref={(el) => { if (el) rowRefs.current.set(t.symbol, el); else rowRefs.current.delete(t.symbol); }}
              className={`rounded-xl transition-all duration-150 opacity-0 animate-slide-up ${
                isOpen ? 'bg-bg-tertiary/40' : ''
              } ${isDragging ? 'opacity-50 scale-[0.97]' : ''} ${
                isDropTarget ? 'ring-1 ring-accent-blue/40 bg-accent-blue/[0.03]' : ''
              }`}
              style={{ animationDelay: `${0.3 + i * 0.05}s` }}
            >
              {/* Collapsed row */}
              <div className="flex items-center">
                {/* Drag handle */}
                <div
                  className="shrink-0 px-1 py-4 cursor-grab active:cursor-grabbing touch-none select-none"
                  onPointerDown={(e) => handleDragStart(t.symbol, e)}
                >
                  <GripIcon />
                </div>

                <button
                  type="button"
                  onClick={() => toggle(t.symbol)}
                  className={`flex-1 flex items-center gap-3 pr-3 py-3 rounded-r-xl transition-colors ${
                    isOpen ? '' : 'hover:bg-bg-tertiary/30'
                  }`}
                >
                  {/* Symbol + Name */}
                  <div className="flex flex-col items-start min-w-[72px]">
                    <span className="font-display font-bold text-sm text-text-primary leading-tight">
                      {t.symbol}
                    </span>
                    <span className="text-[11px] text-text-secondary truncate max-w-[80px] leading-tight mt-0.5">
                      {t.name}
                    </span>
                  </div>

                  {/* Sparkline */}
                  <div className="hidden sm:block shrink-0">
                    {t.sparkline && t.sparkline.length >= 2 ? (
                      <Sparkline data={t.sparkline} />
                    ) : (
                      <div className="w-[80px] h-[28px] bg-bg-tertiary/30 rounded" />
                    )}
                  </div>

                  <div className="flex-1" />

                  {/* Right: Price + Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    {plPercent !== null && (
                      <span
                        className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] font-display font-semibold ${
                          plUp ? 'bg-accent-blue/10 text-accent-blue' : 'bg-accent-red/10 text-accent-red'
                        }`}
                      >
                        P/L {plUp ? '+' : ''}{formatNumber(plPercent)}%
                      </span>
                    )}
                    <div className="flex flex-col items-end">
                      <span className="font-display font-semibold text-sm text-text-primary leading-tight">
                        ${formatNumber(t.price)}
                      </span>
                      <span
                        className={`text-[11px] font-display font-semibold leading-tight mt-0.5 ${
                          isUp ? 'text-accent-green' : 'text-accent-red'
                        }`}
                      >
                        {isUp ? '+' : ''}{formatNumber(t.change)} ({isUp ? '+' : ''}{formatNumber(t.changePercent)}%)
                      </span>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-text-dim transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Expanded detail panel */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-out ${
                  isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-3 pb-4 pt-1 space-y-3">
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
                        {isUp ? '+' : ''}${formatNumber(t.change)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-dim font-display block mb-0.5">시가</span>
                      <span className="text-sm font-display font-medium text-text-primary">${formatNumber(t.open)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-dim font-display block mb-0.5">전일 종가</span>
                      <span className="text-sm font-display font-medium text-text-primary">${formatNumber(t.prevClose)}</span>
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

                  {/* Cost basis input */}
                  <div className="flex items-center gap-3 pt-3 border-t border-bg-tertiary/50">
                    <span className="text-[11px] text-text-dim font-display shrink-0">평균 단가</span>
                    <div className="relative flex-1 max-w-[140px]">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-dim font-display">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="0.00"
                        value={getEditValue(t.symbol)}
                        onChange={(e) => handleCostChange(t.symbol, e.target.value)}
                        onBlur={() => handleCostSave(t.symbol)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCostSave(t.symbol); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-5 pr-2 py-1.5 rounded-md bg-bg-primary border border-bg-tertiary text-sm font-display text-text-primary placeholder:text-text-dim/50 focus:outline-none focus:border-accent-blue/50 transition-colors"
                      />
                    </div>
                    {plPercent !== null && (
                      <span className={`text-sm font-display font-bold ${plUp ? 'text-accent-blue' : 'text-accent-red'}`}>
                        {plUp ? '+' : ''}{formatNumber(plPercent)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
