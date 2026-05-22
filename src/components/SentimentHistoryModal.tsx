'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface AnalystMonth {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

interface RedditDaily {
  date: string;
  mentions: number;
  scoreSum: number;
}

interface HistoryData {
  symbol: string;
  analystTrend: AnalystMonth[];
  redditDaily: RedditDaily[];
  fetchedAt: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function periodToLabel(period: string): string {
  // "0m" / "-1m" / "-2m" / "-3m" → "May" / "Apr" / etc.
  const m = period.match(/^(-?\d+)m$/);
  if (!m) return period;
  const offset = parseInt(m[1], 10);
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return MONTH_NAMES[d.getMonth()];
}

function meanFromMonth(t: AnalystMonth): number | null {
  const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell;
  if (total === 0) return null;
  // 1 = strong buy, 5 = strong sell
  const score = t.strongBuy * 1 + t.buy * 2 + t.hold * 3 + t.sell * 4 + t.strongSell * 5;
  return score / total;
}

// ── Analyst stacked bar chart ──
function AnalystChart({ trend }: { trend: AnalystMonth[] }) {
  if (trend.length === 0) {
    return (
      <p style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
        color: 'var(--text-secondary)', padding: '12px 0',
      }}>
        분석가 데이터가 없습니다
      </p>
    );
  }
  // Yahoo returns oldest → newest? Actually 0m comes first. Let's render oldest left → newest right.
  const ordered = [...trend].sort((a, b) => {
    const ai = parseInt(a.period.replace('m', ''), 10);
    const bi = parseInt(b.period.replace('m', ''), 10);
    return ai - bi; // -3m first, 0m last
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ordered.length}, 1fr)`, gap: '12px', alignItems: 'end' }}>
      {ordered.map((t, i) => {
        const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell;
        const mean = meanFromMonth(t);
        const segs = total > 0 ? [
          { v: t.strongBuy, color: 'var(--accent-green)', op: 1 },
          { v: t.buy,        color: 'var(--accent-green)', op: 0.55 },
          { v: t.hold,       color: 'var(--accent-amber)', op: 0.7 },
          { v: t.sell,       color: 'var(--accent-red)',   op: 0.55 },
          { v: t.strongSell, color: 'var(--accent-red)',   op: 1 },
        ] : [];
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
              color: 'var(--text-secondary)',
            }}>
              {mean != null ? mean.toFixed(2) : '—'}
            </span>
            <div style={{
              width: '100%', height: '110px',
              border: '1px solid var(--bg-tertiary)',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
              {total > 0 && segs.map((s, j) => (
                <div key={j} style={{
                  height: `${(s.v / total) * 100}%`,
                  background: s.color, opacity: s.op,
                }} />
              ))}
            </div>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
              letterSpacing: '0.1em', color: 'var(--text-primary)',
            }}>
              {periodToLabel(t.period)}
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '8px',
              color: 'var(--text-secondary)',
            }}>
              {total} ratings
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Reddit daily mentions chart ──
function RedditDailyChart({ data }: { data: RedditDaily[] }) {
  if (data.length === 0) {
    return (
      <div style={{
        padding: '20px 12px',
        border: '1px solid var(--bg-tertiary)',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
          color: 'var(--text-secondary)', letterSpacing: '0.1em',
        }}>
          누적된 Reddit 데이터가 없습니다
        </p>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '8px',
          color: 'var(--text-secondary)', opacity: 0.6, marginTop: '4px',
          letterSpacing: '0.08em',
        }}>
          서버에서 매일 자동으로 누적합니다
        </p>
      </div>
    );
  }

  const W = 300;
  const H = 80;
  const padX = 4;
  const padTop = 6;
  const padBot = 14;

  const maxM = Math.max(1, ...data.map((d) => d.mentions));
  const xStep = data.length === 1 ? 0 : (W - padX * 2) / (data.length - 1);
  const xScale = (i: number) => padX + i * xStep;
  const yScale = (v: number) => padTop + (H - padTop - padBot) - (v / maxM) * (H - padTop - padBot);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
        {data.map((d, i) => {
          const barH = (d.mentions / maxM) * (H - padTop - padBot);
          const barW = Math.max(2, (W - padX * 2) / Math.max(1, data.length) - 2);
          const x = xScale(i) - barW / 2;
          return (
            <rect
              key={d.date}
              x={x}
              y={H - padBot - barH}
              width={barW}
              height={Math.max(1, barH)}
              fill="var(--accent-amber)"
              opacity={0.85}
            />
          );
        })}
        {/* baseline */}
        <line x1={0} y1={H - padBot} x2={W} y2={H - padBot} stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.6" />
      </svg>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '8px',
        color: 'var(--text-secondary)', marginTop: '4px',
      }}>
        <span>{data[0].date.slice(5).replace('-', '/')}</span>
        {data.length > 2 && (
          <span style={{ opacity: 0.6 }}>
            {data.length} {data.length === 1 ? 'day' : 'days'}
          </span>
        )}
        <span>{data[data.length - 1].date.slice(5).replace('-', '/')}</span>
      </div>
    </div>
  );
}

export default function SentimentHistoryModal({
  symbol, onClose,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sentiment-history?symbol=${encodeURIComponent(symbol)}&days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: HistoryData | null) => {
        if (!cancelled && j) {
          setData(j);
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [symbol]);

  if (!mounted) return null;

  const totalMentions = data?.redditDaily.reduce((s, d) => s + d.mentions, 0) ?? 0;
  const recentMean = data?.analystTrend[0] ? meanFromMonth(data.analystTrend[0]) : null;

  const content = (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
      <div
        className="relative w-full md:w-[440px] max-h-[85vh] overflow-y-auto animate-slide-up"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--text-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--text-primary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 1,
        }}>
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}>
              Sentiment History
            </div>
            <div style={{
              fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)',
              letterSpacing: '-0.01em', marginTop: '2px',
            }}>
              {symbol}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: 'transparent', border: '1px solid var(--text-secondary)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              padding: '4px 10px',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
            }}
          >
            ✕
          </button>
        </div>

        {loading && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}>
              Loading...
            </p>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Analyst trend */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--text-primary)' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--text-secondary)', marginBottom: '12px',
              }}>
                <span>Analyst Trend · 4 Months</span>
                {recentMean != null && (
                  <span style={{ color: 'var(--text-primary)' }}>mean {recentMean.toFixed(2)}/5</span>
                )}
              </div>
              <AnalystChart trend={data.analystTrend} />
              <div style={{
                marginTop: '10px',
                display: 'flex', flexWrap: 'wrap', gap: '8px',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '8px',
                color: 'var(--text-secondary)',
              }}>
                <Legend color="var(--accent-green)" op={1} label="Strong Buy" />
                <Legend color="var(--accent-green)" op={0.55} label="Buy" />
                <Legend color="var(--accent-amber)" op={0.7} label="Hold" />
                <Legend color="var(--accent-red)" op={0.55} label="Sell" />
                <Legend color="var(--accent-red)" op={1} label="Strong Sell" />
              </div>
            </div>

            {/* Reddit history */}
            <div style={{ padding: '14px 16px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--text-secondary)', marginBottom: '8px',
              }}>
                <span>Reddit Chatter · {data.redditDaily.length}D</span>
                {data.redditDaily.length > 0 && (
                  <span style={{ color: 'var(--text-primary)' }}>{totalMentions} mentions total</span>
                )}
              </div>
              <RedditDailyChart data={data.redditDaily} />
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function Legend({ color, op, label }: { color: string; op: number; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <i style={{ width: '8px', height: '8px', background: color, opacity: op }} />
      {label}
    </span>
  );
}
