'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

interface ChartPoint {
  timestamp: number;
  close: number;
}

interface PeriodReturn {
  period: string;
  changePercent: number;
}

interface CoinData {
  symbol: string;
  label: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  chart: ChartPoint[];
  periodReturns: PeriodReturn[];
}

interface CoinTabProps {
  refreshKey?: number;
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// --- Mini area chart via SVG ---
function CoinChart({ data, color, id }: { data: ChartPoint[]; color: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; price: number; date: string } | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const ready = data.length >= 2 && dims.w > 0 && dims.h > 0;

  const W = dims.w || 1;
  const H = dims.h || 1;
  const padTop = 20;
  const padBottom = 24;
  const chartH = H - padTop - padBottom;
  const chartW = W;

  const prices = ready ? data.map((d) => d.close) : [0, 1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const xScale = (i: number) => (i / (Math.max(data.length - 1, 1))) * chartW;
  const yScale = (v: number) => padTop + chartH - ((v - min) / range) * chartH;

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!ready) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.round((px / chartW) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setTooltip({
      x: xScale(clamped),
      y: yScale(data[clamped].close),
      price: data[clamped].close,
      date: formatDate(data[clamped].timestamp),
    });
  }, [ready, data, chartW]);

  const handlePointerLeave = useCallback(() => setTooltip(null), []);

  const linePath = useMemo(() => {
    if (!ready) return '';
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(d.close).toFixed(1)}`).join(' ');
  }, [ready, data, W, H]);

  const areaPath = useMemo(() => {
    if (!ready) return '';
    return `${linePath} L${xScale(data.length - 1).toFixed(1)},${H - padBottom} L${xScale(0).toFixed(1)},${H - padBottom} Z`;
  }, [ready, linePath, data.length, W, H]);

  const xLabels = useMemo(() => {
    if (!ready) return [];
    const labelCount = 5;
    const step = Math.floor(data.length / (labelCount - 1));
    const labels: { x: number; label: string }[] = [];
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.min(i * step, data.length - 1);
      labels.push({ x: xScale(idx), label: formatDate(data[idx].timestamp) });
    }
    return labels;
  }, [ready, data, W, H]);

  if (!ready) {
    return <div ref={containerRef} className="w-full h-full" />;
  }

  return (
    <div ref={containerRef} className="w-full h-full">
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      className="touch-none"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => {
        const y = padTop + chartH * (1 - frac);
        return <line key={frac} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />;
      })}

      {/* Area + Line */}
      <path d={areaPath} fill={`url(#grad-${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

      {/* X labels */}
      {xLabels.map(({ x, label }, i) => (
        <text key={i} x={x} y={H - 6} textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="'JetBrains Mono', monospace">
          {label}
        </text>
      ))}

      {/* Tooltip */}
      {tooltip && (
        <>
          <line x1={tooltip.x} y1={padTop} x2={tooltip.x} y2={H - padBottom} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <circle cx={tooltip.x} cy={tooltip.y} r="4" fill={color} stroke="var(--bg-primary)" strokeWidth="2" />
          <rect x={tooltip.x - 40} y={tooltip.y - 28} width="80" height="20" rx="4" fill="var(--bg-tertiary)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <text x={tooltip.x} y={tooltip.y - 15} textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="500">
            ${formatPrice(tooltip.price)}
          </text>
        </>
      )}
    </svg>
    </div>
  );
}

// --- Coin card ---
function CoinCard({ coin, loading }: { coin: CoinData | null; loading: boolean }) {
  if (loading || !coin) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-5 card-hover">
        <div className="flex items-center justify-between mb-4">
          <div className="animate-pulse bg-bg-tertiary rounded h-6 w-24" />
          <div className="animate-pulse bg-bg-tertiary rounded h-6 w-32" />
        </div>
        <div className="animate-pulse bg-bg-tertiary rounded-xl h-[200px] mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-bg-tertiary rounded-lg h-14 flex-1" />
          ))}
        </div>
      </div>
    );
  }

  const isUp = coin.changePercent >= 0;
  const accentColor = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
  const icon = coin.symbol === 'BTC-USD' ? '₿' : 'Ξ';

  return (
    <div data-no-swipe className="bg-bg-secondary rounded-2xl p-5 card-hover opacity-0 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-bold" style={{ color: coin.symbol === 'BTC-USD' ? '#f7931a' : '#627eea' }}>
            {icon}
          </span>
          <div>
            <h3 className="text-sm font-display font-semibold text-text-primary">{coin.label}</h3>
            <span className="text-[10px] text-text-dim font-display">{coin.symbol.replace('-USD', '')}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold text-text-primary">${formatPrice(coin.currentPrice)}</p>
          <p className={`font-mono text-xs font-medium ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
            {isUp ? '▲' : '▼'} {formatPercent(coin.changePercent)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-[200px] mb-4 rounded-xl bg-bg-primary/40 overflow-hidden p-1">
        <CoinChart data={coin.chart} color={accentColor} id={coin.symbol} />
      </div>

      {/* Period returns */}
      <div className="grid grid-cols-4 gap-2">
        {coin.periodReturns.map((pr) => {
          const up = pr.changePercent >= 0;
          return (
            <div
              key={pr.period}
              className="rounded-xl p-2.5 text-center"
              style={{ backgroundColor: up ? 'rgba(0,255,135,0.06)' : 'rgba(255,51,102,0.06)' }}
            >
              <span className="block text-[10px] text-text-dim font-display font-medium mb-1">
                {pr.period}
              </span>
              <span
                className="block font-mono text-sm font-bold"
                style={{ color: up ? 'var(--accent-green)' : 'var(--accent-red)' }}
              >
                {formatPercent(pr.changePercent)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main Tab ---
function CoinTab({ refreshKey }: CoinTabProps) {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/coin');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setCoins(json.coins ?? []);
      } catch (e) {
        console.error('Coin fetch error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const btc = coins.find((c) => c.symbol === 'BTC-USD') ?? null;
  const eth = coins.find((c) => c.symbol === 'ETH-USD') ?? null;

  return (
    <div className="space-y-4">
      <CoinCard coin={btc} loading={loading} />
      <CoinCard coin={eth} loading={loading} />
    </div>
  );
}

export default React.memo(CoinTab);
