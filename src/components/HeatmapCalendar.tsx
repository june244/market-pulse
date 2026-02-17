'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { DayScore, HistoryResponse } from '@/lib/types';

// Same 7-level color scheme as MarketThermometer
const LEVELS = [
  { max: 15, label: '극한', color: '#3366ff' },
  { max: 30, label: '냉각', color: '#4499ff' },
  { max: 45, label: '서늘', color: '#00ccaa' },
  { max: 55, label: '적정', color: '#88cc44' },
  { max: 70, label: '온기', color: '#ffaa00' },
  { max: 85, label: '과열', color: '#ff6644' },
  { max: 100, label: '극과열', color: '#ff3366' },
];

function getLevel(score: number) {
  for (const l of LEVELS) {
    if (score <= l.max) return l;
  }
  return LEVELS[LEVELS.length - 1];
}

const DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];

interface MonthGroup {
  key: string; // "YYYY-MM"
  year: number;
  month: number; // 1-indexed
  label: string;
  days: (DayScore | null)[]; // padded with null for leading empty cells
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
    const label = new Date(y, m - 1, 1).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    const firstDate = new Date(y, m - 1, 1);
    const leadingPad = firstDate.getDay();
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

// Detail modal
function DayDetail({ day, onClose }: { day: DayScore; onClose: () => void }) {
  const level = getLevel(day.composite);
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
        className="relative w-full md:w-96 bg-bg-secondary rounded-t-2xl md:rounded-2xl p-6 pb-8 md:pb-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-bg-tertiary rounded-full mx-auto mb-4 md:hidden" />
        <p className="text-sm text-text-secondary font-display mb-4">{dateLabel}</p>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-display font-bold text-white"
            style={{ backgroundColor: level.color }}
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
          className="mt-5 w-full py-2.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-display font-medium hover:bg-bg-tertiary/80 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-tertiary/50 rounded-xl p-3">
      <p className="text-[10px] text-text-dim font-display mb-1">{label}</p>
      <p className="text-sm font-display font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-bg-secondary rounded-2xl p-4">
        <div className="animate-pulse bg-bg-tertiary rounded h-4 w-40 mb-2" />
        <div className="flex gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-bg-tertiary rounded-sm h-3 flex-1" />
          ))}
        </div>
      </div>
      <div className="bg-bg-secondary rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="animate-pulse bg-bg-tertiary rounded h-5 w-8" />
          <div className="animate-pulse bg-bg-tertiary rounded h-5 w-32" />
          <div className="animate-pulse bg-bg-tertiary rounded h-5 w-8" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, j) => (
            <div key={j} className="animate-pulse bg-bg-tertiary rounded-lg aspect-square" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Nav arrow button
function NavButton({ direction, disabled, onClick }: { direction: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/80 transition-colors text-text-secondary disabled:opacity-20 disabled:pointer-events-none"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'prev'
          ? <path d="M15 18l-6-6 6-6" />
          : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}

function HeatmapCalendar() {
  const [data, setData] = useState<DayScore[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayScore | null>(null);
  const [monthIndex, setMonthIndex] = useState(-1); // -1 = not set yet, will default to last month

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/history');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: HistoryResponse = await res.json();
        if (!cancelled) {
          setData(json.days);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const months = useMemo(() => (data ? groupByMonth(data) : []), [data]);

  // Default to the latest (current) month once data loads
  const currentMonthIdx = monthIndex < 0 ? months.length - 1 : monthIndex;
  const currentMonth = months[currentMonthIdx] ?? null;

  // Sync monthIndex when data first loads
  useEffect(() => {
    if (months.length > 0 && monthIndex < 0) {
      setMonthIndex(months.length - 1);
    }
  }, [months, monthIndex]);

  const handleDayClick = useCallback((day: DayScore) => {
    if (day.marketOpen) setSelectedDay(day);
  }, []);

  const goPrev = useCallback(() => setMonthIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setMonthIndex((i) => Math.min(months.length - 1, i + 1)), [months.length]);

  if (loading) return <CalendarSkeleton />;

  if (error) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-6">
        <p className="text-sm text-accent-red font-display">데이터 로딩 실패: {error}</p>
      </div>
    );
  }

  if (!currentMonth) return null;

  return (
    <div className="space-y-4 opacity-0 animate-fade-in">
      {/* Legend */}
      <div className="bg-bg-secondary rounded-2xl p-4 card-hover">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-sm font-medium text-text-secondary tracking-wider uppercase">시장 히트맵</h3>
          <span className="text-[10px] text-text-dim font-display">최근 3개월</span>
        </div>
        <div className="flex items-center gap-1">
          {LEVELS.map((l) => (
            <div key={l.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full h-3 rounded-sm"
                style={{ backgroundColor: l.color }}
              />
              <span className="text-[9px] text-text-dim font-display">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Single month with navigation */}
      <div className="bg-bg-secondary rounded-2xl p-4 card-hover">
        {/* Month header with arrows */}
        <div className="flex items-center justify-between mb-4">
          <NavButton direction="prev" disabled={currentMonthIdx <= 0} onClick={goPrev} />
          <h3 className="font-display text-sm font-medium text-text-primary">{currentMonth.label}</h3>
          <NavButton direction="next" disabled={currentMonthIdx >= months.length - 1} onClick={goNext} />
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[10px] text-text-dim font-display py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {currentMonth.days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const dateNum = parseInt(day.date.split('-')[2], 10);

            if (!day.marketOpen) {
              return (
                <div
                  key={day.date}
                  className="aspect-square rounded-lg bg-bg-tertiary opacity-30 flex items-center justify-center"
                >
                  <span className="text-[10px] text-text-dim font-display">{dateNum}</span>
                </div>
              );
            }

            const level = getLevel(day.composite);
            return (
              <button
                key={day.date}
                onClick={() => handleDayClick(day)}
                className="aspect-square rounded-lg flex items-center justify-center transition-transform active:scale-90 hover:ring-2 hover:ring-white/20"
                style={{ backgroundColor: level.color }}
                title={`${day.date}: ${day.composite}°`}
              >
                <span className="text-[10px] font-display font-medium text-white/90 drop-shadow-sm">
                  {dateNum}
                </span>
              </button>
            );
          })}
        </div>

        {/* Page dots */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {months.map((_, i) => (
            <button
              key={i}
              onClick={() => setMonthIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentMonthIdx ? 'bg-accent-green' : 'bg-bg-tertiary'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <DayDetail day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}

export default React.memo(HeatmapCalendar);
