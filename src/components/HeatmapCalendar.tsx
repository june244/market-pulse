'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DayScore, HistoryResponse, Trade } from '@/lib/types';
import { getScoreLevel, getScoreLevels, loadTrades } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

interface PortfolioPoint {
  date: string;
  value: number;
  invested: number;
  plPercent: number;
  plAmount: number;
}

const DOW_HEADERS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface CalendarEvent {
  date: string;
  dateKey: string;
  title: string;
  country: string;
  impact: 'High' | 'Medium';
}

interface MonthGroup {
  key: string;       // "YYYY-MM"
  year: number;
  month: number;     // 1-indexed
  label: string;     // "April 2026"
  days: (DayScore | null)[]; // padded with null for leading empty cells (Monday-first)
}

function groupByMonth(days: DayScore[]): MonthGroup[] {
  const map = new Map<string, DayScore[]>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }

  const groups: MonthGroup[] = [];
  for (const [key, monthDays] of Array.from(map.entries())) {
    const [y, m] = key.split('-').map(Number);
    const label = `${MONTH_NAMES[m - 1]} ${y}`;
    const firstDate = new Date(y, m - 1, 1);
    // Monday-first: shift day index. Sun=0 → 6, Mon=1 → 0, …, Sat=6 → 5
    const dow = firstDate.getDay();
    const leadingPad = (dow + 6) % 7;
    const padded: (DayScore | null)[] = Array(leadingPad).fill(null);

    const dayMap = new Map(monthDays.map((d) => [d.date, d]));
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      padded.push(dayMap.get(dateStr) ?? null);
    }

    groups.push({ key, year: y, month: m, label, days: padded });
  }

  return groups;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function todayKeyET(): string {
  // Approximate today in ET — date string only.
  // Using the user's local timezone is acceptable for highlight purposes since
  // the historyStore uses ET and most users are within a few hours of it.
  const now = new Date();
  // ET = UTC-5 (winter) / UTC-4 (summer); for highlight only, use UTC date as fallback.
  const etOffsetH = -4;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const et = new Date(utcMs + etOffsetH * 60 * 60 * 1000);
  return et.toISOString().slice(0, 10);
}

// ── Day detail modal ──
function DayDetail({ day, onClose }: { day: DayScore; onClose: () => void }) {
  const theme = useTheme();
  const level = getScoreLevel(day.composite, theme);
  const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full md:w-96 p-6 pb-8 md:pb-6 animate-slide-up"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--text-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-px mx-auto mb-4 md:hidden" style={{ background: 'var(--bg-tertiary)' }} />
        <p className="text-sm text-text-secondary font-display mb-4">{dateLabel}</p>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 flex items-center justify-center text-2xl font-display font-bold"
            style={{ backgroundColor: level.color, color: '#fff' }}
          >
            {day.composite}
          </div>
          <div>
            <p className="text-lg font-display font-semibold text-text-primary">{level.label}</p>
            <p className="text-xs text-text-dim font-display">Composite Score</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Indicator label="Fear & Greed" value={day.fg != null ? String(day.fg) : '—'} />
          <Indicator label="VIX" value={day.vix != null ? day.vix.toFixed(1) : '—'} />
          <Indicator label="10Y 변화" value={day.tnxChange != null ? `${day.tnxChange > 0 ? '+' : ''}${day.tnxChange.toFixed(2)}%` : '—'} />
          <Indicator label="DXY 변화" value={day.dxyChange != null ? `${day.dxyChange > 0 ? '+' : ''}${day.dxyChange.toFixed(2)}%` : '—'} />
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 text-sm font-display font-medium transition-colors"
          style={{ border: '1px solid var(--bg-tertiary)', background: 'transparent', color: 'var(--text-secondary)' }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--bg-tertiary)', padding: '12px' }}>
      <p className="text-[10px] text-text-dim font-display mb-1">{label}</p>
      <p className="text-sm font-display font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="opacity-0 animate-fade-in" style={{ borderTop: '1px solid var(--text-primary)' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--text-primary)' }}>
        <div className="animate-pulse h-3 w-32" style={{ background: 'var(--bg-tertiary)' }} />
        <div className="animate-pulse h-[50px] w-full mt-3" style={{ background: 'var(--bg-tertiary)', opacity: 0.5 }} />
      </div>
      <div style={{ padding: '10px 16px' }}>
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 28 }).map((_, j) => (
            <div key={j} className="animate-pulse aspect-square" style={{ background: 'var(--bg-tertiary)', opacity: 0.5 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 90-day Temperature History (n-hist) ──
function HistoryLineChart({ data }: { data: DayScore[] }) {
  const theme = useTheme();
  const days = data.filter((d) => d.marketOpen).slice(-90);
  if (days.length < 3) return null;

  const W = 300;
  const H = 50;

  const xScale = (i: number) => (i / (days.length - 1)) * W;
  const yScale = (v: number) => H - (v / 100) * H;

  const linePath = days.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(d.composite).toFixed(1)}`
  ).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  const lastScore = days[days.length - 1].composite;
  const lineColor = getScoreLevel(lastScore, theme).color;

  // 4 month labels along the x axis
  const monthLabels: { idx: number; label: string }[] = [];
  let lastMonth = '';
  days.forEach((d, i) => {
    const m = d.date.slice(5, 7);
    if (m !== lastMonth) {
      lastMonth = m;
      monthLabels.push({ idx: i, label: MONTH_NAMES[parseInt(m, 10) - 1].slice(0, 3).toUpperCase() });
    }
  });
  const visibleLabels = monthLabels.slice(-4);

  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--text-primary)' }}>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Temperature History · 90D</span>
        <span style={{ color: 'var(--accent-amber)' }}>{lastScore.toFixed(1)}°</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="50"
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <line
          x1={0} y1={H / 2} x2={W} y2={H / 2}
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="0.8"
        />
        <path d={areaPath} fill={lineColor} fillOpacity={theme === 'nordic-light' ? 0.08 : 0.12} />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={xScale(days.length - 1)} cy={yScale(lastScore)} r="3" fill={lineColor} />
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '8px',
          color: 'var(--text-secondary)',
          marginTop: '3px',
        }}
      >
        {visibleLabels.map((l) => (
          <span key={`${l.idx}-${l.label}`}>{l.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Portfolio Return chart (overlay on temperature axis) ──
function PortfolioReturnChart({ points }: { points: PortfolioPoint[] }) {
  if (points.length < 2) return null;

  const W = 300;
  const H = 50;

  const lastPL = points[points.length - 1].plPercent;
  // Auto-scale to data range with mild padding
  const plValues = points.map((p) => p.plPercent);
  const minPL = Math.min(...plValues, 0);
  const maxPL = Math.max(...plValues, 0);
  const span = Math.max(2, maxPL - minPL);
  const padTop = span * 0.1;
  const padBot = span * 0.1;
  const lo = minPL - padBot;
  const hi = maxPL + padTop;
  const range = hi - lo;

  const xScale = (i: number) => (i / (points.length - 1)) * W;
  const yScale = (v: number) => H - ((v - lo) / range) * H;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.plPercent).toFixed(1)}`)
    .join(' ');

  // Area to baseline (zero) when zero is within range; else to bottom
  const zeroY = lo <= 0 && hi >= 0 ? yScale(0) : H;
  const areaPath = `${linePath} L${W},${zeroY} L0,${zeroY} Z`;

  const isUp = lastPL >= 0;
  const lineColor = isUp ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--text-primary)' }}>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Portfolio Return · 90D</span>
        <span style={{ color: lineColor }}>
          {isUp ? '+' : ''}{lastPL.toFixed(2)}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="50"
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* Zero baseline */}
        {lo <= 0 && hi >= 0 && (
          <line
            x1={0} y1={zeroY} x2={W} y2={zeroY}
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
        )}
        <path d={areaPath} fill={lineColor} fillOpacity="0.12" />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={xScale(points.length - 1)} cy={yScale(lastPL)} r="3" fill={lineColor} />
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '8px',
          color: 'var(--text-secondary)',
          marginTop: '3px',
        }}
      >
        <span>{points[0].date.slice(5).replace('-', '/')}</span>
        <span>{points[points.length - 1].date.slice(5).replace('-', '/')}</span>
      </div>
    </div>
  );
}

// ── Score Levels legend (n-heat-leg) ──
function ScoreLevelsLegend() {
  const theme = useTheme();
  const levels = getScoreLevels(theme);
  return (
    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--text-primary)' }}>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
        }}
      >
        Score Levels
      </div>
      <div style={{ display: 'flex', gap: '3px' }}>
        {levels.map((l) => (
          <div key={l.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div style={{ width: '100%', height: '8px', background: l.color }} />
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '7px',
                color: 'var(--text-secondary)',
              }}
            >
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calendar grid (n-cal) ──
function CalendarGrid({
  month, currentMonthIdx, totalMonths, eventKeys, todayKey, theme, onPrev, onNext, onDayClick,
}: {
  month: MonthGroup;
  currentMonthIdx: number;
  totalMonths: number;
  eventKeys: Set<string>;
  todayKey: string;
  theme: 'nordic' | 'nordic-light';
  onPrev: () => void;
  onNext: () => void;
  onDayClick: (d: DayScore) => void;
}) {
  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--text-primary)' }}>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--text-primary)' }}>{month.label}</span>
        <span style={{ display: 'inline-flex', gap: '8px' }}>
          <button
            onClick={onPrev}
            disabled={currentMonthIdx <= 0}
            aria-label="이전 달"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)',
              opacity: currentMonthIdx <= 0 ? 0.3 : 1,
              padding: 0, fontSize: '12px', lineHeight: 1,
            }}
          >‹</button>
          <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>·</span>
          <button
            onClick={onNext}
            disabled={currentMonthIdx >= totalMonths - 1}
            aria-label="다음 달"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)',
              opacity: currentMonthIdx >= totalMonths - 1 ? 0.3 : 1,
              padding: 0, fontSize: '12px', lineHeight: 1,
            }}
          >›</button>
        </span>
      </div>

      {/* Day-of-week header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '8px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          padding: '3px 0',
          borderBottom: '1px solid var(--text-primary)',
        }}
      >
        {DOW_HEADERS.map((d) => <span key={d}>{d}</span>)}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {month.days.map((day, idx) => {
          const isLastCol = (idx % 7) === 6;
          const baseStyle: React.CSSProperties = {
            aspectRatio: '1',
            borderRight: isLastCol ? 'none' : '1px solid var(--bg-tertiary)',
            borderBottom: '1px solid var(--bg-tertiary)',
            padding: '3px 4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          };

          if (!day) {
            return <div key={`pad-${idx}`} style={baseStyle} />;
          }

          const dateNum = parseInt(day.date.split('-')[2], 10);
          const isToday = day.date === todayKey;
          const hasEvent = eventKeys.has(day.date);

          if (!day.marketOpen) {
            return (
              <div key={day.date} style={{ ...baseStyle, color: 'var(--bg-tertiary)' }}>
                <span>{dateNum}</span>
              </div>
            );
          }

          const level = getScoreLevel(day.composite, theme);
          const tintAlpha = theme === 'nordic-light' ? 0.18 : 0.25;
          const bg = isToday ? 'var(--text-primary)' : hexToRgba(level.color, tintAlpha);
          const color = isToday ? 'var(--bg-primary)' : 'var(--text-primary)';

          return (
            <button
              key={day.date}
              onClick={() => onDayClick(day)}
              title={`${day.date}: ${day.composite}°`}
              style={{
                ...baseStyle,
                background: bg,
                color,
                border: 'none',
                borderRight: isLastCol ? 'none' : '1px solid var(--bg-tertiary)',
                borderBottom: '1px solid var(--bg-tertiary)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{dateNum}</span>
              {hasEvent && (
                <span
                  style={{
                    width: '3px',
                    height: '3px',
                    background: isToday ? 'var(--bg-primary)' : 'var(--accent-amber)',
                    borderRadius: '50%',
                    alignSelf: 'flex-end',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Events list (n-events) ──
function EventsList({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  // Show next ~6 events from now
  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.date).getTime() >= now - 6 * 60 * 60 * 1000)
    .slice(0, 6);

  if (upcoming.length === 0) return null;

  return (
    <div style={{ padding: '8px 16px' }}>
      {upcoming.map((e, i) => {
        const d = new Date(e.date);
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const isHigh = e.impact === 'High';
        return (
          <div
            key={`${e.date}-${e.title}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '8px',
              padding: '7px 0',
              borderBottom: i === upcoming.length - 1 ? 'none' : '1px solid var(--bg-tertiary)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              alignItems: 'baseline',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
              {dd} · {hh}:{mm}
            </span>
            <span style={{
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}>
              {e.title}
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.1em',
              color: isHigh ? 'var(--accent-red)' : 'var(--accent-amber)',
            }}>
              {isHigh ? 'HIGH' : 'MED'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeatmapCalendar() {
  const theme = useTheme();
  const [data, setData] = useState<DayScore[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [portfolioPoints, setPortfolioPoints] = useState<PortfolioPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayScore | null>(null);
  const [monthIndex, setMonthIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [hRes, eRes] = await Promise.all([
          fetch('/api/history', { cache: 'no-store' }),
          fetch('/api/events').catch(() => null),
        ]);
        if (!hRes.ok) throw new Error(`HTTP ${hRes.status}`);
        const hJson: HistoryResponse = await hRes.json();
        if (!cancelled) {
          setData(hJson.days);
          setLoading(false);
        }
        if (eRes && eRes.ok) {
          const eJson: { events: CalendarEvent[] } = await eRes.json();
          if (!cancelled) setEvents(eJson.events ?? []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }

      // Portfolio P/L history (only when user has trades)
      try {
        const trades: Record<string, Trade[]> = loadTrades();
        const hasTrades = Object.values(trades).some((arr) => Array.isArray(arr) && arr.length > 0);
        if (!hasTrades) return;
        const pRes = await fetch('/api/portfolio-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trades }),
        });
        if (!pRes.ok) return;
        const pJson: { points: PortfolioPoint[] } = await pRes.json();
        if (!cancelled) setPortfolioPoints((pJson.points ?? []).slice(-90));
      } catch {
        // Non-critical; ignore
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const months = useMemo(() => (data ? groupByMonth(data) : []), [data]);
  const eventKeys = useMemo(() => new Set(events.map((e) => e.dateKey)), [events]);
  const todayKey = useMemo(() => todayKeyET(), []);

  const currentMonthIdx = monthIndex < 0 ? months.length - 1 : monthIndex;
  const currentMonth = months[currentMonthIdx] ?? null;

  useEffect(() => {
    if (months.length > 0 && monthIndex < 0) {
      setMonthIndex(months.length - 1);
    }
  }, [months, monthIndex]);

  const handleDayClick = useCallback((day: DayScore) => {
    if (day.marketOpen) setSelectedDay(day);
  }, []);

  const goPrev = useCallback(() => setMonthIndex((i) => Math.max(0, (i < 0 ? months.length - 1 : i) - 1)), [months.length]);
  const goNext = useCallback(() => setMonthIndex((i) => Math.min(months.length - 1, (i < 0 ? months.length - 1 : i) + 1)), [months.length]);

  if (loading) return <CalendarSkeleton />;

  if (error) {
    return (
      <div style={{ padding: '16px', borderTop: '1px solid var(--text-primary)' }}>
        <p className="text-sm text-accent-red font-display">데이터 로딩 실패: {error}</p>
      </div>
    );
  }

  if (!currentMonth) return null;

  return (
    <div className="opacity-0 animate-fade-in" style={{ borderTop: '1px solid var(--text-primary)' }}>
      {data && <HistoryLineChart data={data} />}
      {portfolioPoints.length >= 2 && <PortfolioReturnChart points={portfolioPoints} />}
      <ScoreLevelsLegend />
      <CalendarGrid
        month={currentMonth}
        currentMonthIdx={currentMonthIdx}
        totalMonths={months.length}
        eventKeys={eventKeys}
        todayKey={todayKey}
        theme={theme}
        onPrev={goPrev}
        onNext={goNext}
        onDayClick={handleDayClick}
      />
      <EventsList events={events} />

      {selectedDay && createPortal(
        <DayDetail day={selectedDay} onClose={() => setSelectedDay(null)} />,
        document.body,
      )}
    </div>
  );
}

export default React.memo(HeatmapCalendar);
