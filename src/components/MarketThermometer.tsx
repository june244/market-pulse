'use client';

import React, { useMemo } from 'react';
import { FearGreedData, VIXData, MacroItem } from '@/lib/types';

interface Props {
  fearGreed: FearGreedData | null;
  vix: VIXData | null;
  macro: MacroItem[];
  loading: boolean;
}

interface TempLevel {
  label: string;
  color: string;
  message: string;
}

const LEVELS: { max: number; level: TempLevel }[] = [
  { max: 15, level: { label: '극한', color: '#3366ff', message: '극심한 공포 구간. 시장이 얼어붙었습니다. 역사적으로 저가 매수 기회가 될 수 있습니다.' } },
  { max: 30, level: { label: '냉각', color: '#4499ff', message: '시장이 위축되어 있습니다. 리스크 회피 심리가 지배적입니다.' } },
  { max: 45, level: { label: '서늘', color: '#00ccaa', message: '다소 냉각된 시장. 경계심이 있으나 안정적인 구간입니다.' } },
  { max: 55, level: { label: '적정', color: '#88cc44', message: '시장 온도가 적정 수준입니다. 균형 잡힌 심리 상태입니다.' } },
  { max: 70, level: { label: '온기', color: '#ffaa00', message: '낙관론이 확산되고 있습니다. 과열 신호에 주의하세요.' } },
  { max: 85, level: { label: '과열', color: '#ff6644', message: '시장이 과열되고 있습니다. 신규 진입 시 주의가 필요합니다.' } },
  { max: 100, level: { label: '극과열', color: '#ff3366', message: '극단적 탐욕 구간. 시장이 끓고 있습니다. 리스크 관리에 집중하세요.' } },
];

function getLevel(score: number): TempLevel {
  for (const { max, level } of LEVELS) {
    if (score <= max) return level;
  }
  return LEVELS[LEVELS.length - 1].level;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function computeScore(
  fearGreed: FearGreedData | null,
  vix: VIXData | null,
  macro: MacroItem[],
): { composite: number; sub: { label: string; key: string; score: number }[] } | null {
  const entries: { weight: number; score: number; label: string; key: string }[] = [];

  if (fearGreed) {
    entries.push({ weight: 40, score: clamp(fearGreed.score, 0, 100), label: 'F&G', key: 'fg' });
  }

  if (vix) {
    // Inverse: low VIX = hot
    const normalized = 100 - (clamp(vix.value, 10, 40) - 10) / 30 * 100;
    entries.push({ weight: 30, score: Math.round(normalized), label: 'VIX', key: 'vix' });
  }

  const tnx = macro.find((m) => m.symbol === '^TNX');
  if (tnx) {
    // Inverse of daily change%: rising yield = cooling
    const normalized = 50 - (clamp(tnx.changePercent, -3, 3) / 3) * 50;
    entries.push({ weight: 15, score: Math.round(normalized), label: 'TNX', key: 'tnx' });
  }

  const dxy = macro.find((m) => m.symbol === 'DX-Y.NYB');
  if (dxy) {
    // Inverse of daily change%: rising dollar = cooling
    const normalized = 50 - (clamp(dxy.changePercent, -2, 2) / 2) * 50;
    entries.push({ weight: 15, score: Math.round(normalized), label: 'DXY', key: 'dxy' });
  }

  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  const composite = Math.round(
    entries.reduce((s, e) => s + (e.score * e.weight) / totalWeight, 0),
  );

  return {
    composite: clamp(composite, 0, 100),
    sub: entries.map((e) => ({ label: e.label, key: e.key, score: e.score })),
  };
}

function MarketThermometer({ fearGreed, vix, macro, loading }: Props) {
  const result = useMemo(() => computeScore(fearGreed, vix, macro), [fearGreed, vix, macro]);

  if (loading || !result) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-6 card-hover animate-pulse">
        <div className="h-5 w-28 bg-bg-tertiary rounded mb-5" />
        <div className="flex gap-6">
          <div className="w-16 h-40 bg-bg-tertiary rounded-full" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-10 w-20 bg-bg-tertiary rounded" />
            <div className="h-5 w-16 bg-bg-tertiary rounded" />
            <div className="flex gap-2 mt-4">
              <div className="h-6 w-16 bg-bg-tertiary rounded-full" />
              <div className="h-6 w-16 bg-bg-tertiary rounded-full" />
            </div>
          </div>
        </div>
        <div className="h-4 w-full bg-bg-tertiary rounded mt-4" />
      </div>
    );
  }

  const { composite, sub } = result;
  const level = getLevel(composite);
  const mercuryPercent = composite;

  // Thermometer SVG dimensions
  const cx = 30;          // center x of tube & bulb
  const tubeW = 16;       // tube width
  const tubeR = tubeW / 2;
  const tubeTop = 12;
  const tubeBot = 130;
  const tubeH = tubeBot - tubeTop;
  const bulbR = 14;       // bulb radius
  const bulbCY = tubeBot + bulbR - 2; // overlap slightly with tube
  const mercuryH = (mercuryPercent / 100) * tubeH;
  const mercuryTop = tubeBot - mercuryH;

  // Outer shell path: tube + bulb as one continuous shape
  const outerPath = `
    M ${cx - tubeR} ${tubeTop + tubeR}
    A ${tubeR} ${tubeR} 0 0 1 ${cx + tubeR} ${tubeTop + tubeR}
    L ${cx + tubeR} ${tubeBot - 2}
    A ${bulbR} ${bulbR} 0 1 1 ${cx - tubeR} ${tubeBot - 2}
    Z
  `;

  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="bg-bg-secondary rounded-2xl p-6 card-hover opacity-0 animate-fade-in stagger-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-sm font-medium tracking-wider text-text-secondary uppercase">
          시장 온도계
        </h2>
        <span
          className="text-xs font-display font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${level.color}18`, color: level.color }}
        >
          {level.label}
        </span>
      </div>

      {/* Body */}
      <div className="flex gap-5">
        {/* Thermometer SVG */}
        <div className="flex-shrink-0">
          <svg width="60" height="175" viewBox="0 0 60 175">
            <defs>
              <linearGradient id="thermoGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#3366ff" />
                <stop offset="30%" stopColor="#00ccaa" />
                <stop offset="50%" stopColor="#88cc44" />
                <stop offset="70%" stopColor="#ffaa00" />
                <stop offset="100%" stopColor="#ff3366" />
              </linearGradient>
              <clipPath id="thermoClip">
                <path d={outerPath} />
              </clipPath>
            </defs>

            {/* Outer shell */}
            <path d={outerPath} fill="#1a1a28" />

            {/* Mercury: fills from bulb up through tube, clipped to shell */}
            <rect
              x={cx - bulbR}
              y={mercuryTop}
              width={bulbR * 2}
              height={bulbCY + bulbR - mercuryTop}
              clipPath="url(#thermoClip)"
              fill="url(#thermoGrad)"
              style={{
                transition: 'y 1s ease-out, height 1s ease-out',
                filter: `drop-shadow(0 0 4px ${level.color}88)`,
              }}
            />

            {/* Bulb glow overlay */}
            <circle
              cx={cx}
              cy={bulbCY}
              r={bulbR - 5}
              fill={level.color}
              opacity="0.4"
              style={{ filter: `drop-shadow(0 0 10px ${level.color})` }}
            />

            {/* Scale ticks */}
            {ticks.map((t) => {
              const y = tubeBot - (t / 100) * tubeH;
              return (
                <g key={t}>
                  <line x1={cx + tubeR + 3} y1={y} x2={cx + tubeR + 8} y2={y} stroke="#555570" strokeWidth="1" />
                  <text x={cx + tubeR + 11} y={y + 3} fill="#555570" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    {t}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Score + sub-indicators */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-start gap-0.5">
            <span
              className="text-4xl font-display font-bold tracking-tight"
              style={{ color: level.color }}
            >
              {composite}
            </span>
            <span className="text-sm text-text-dim font-display mt-1">°</span>
          </div>
          <p
            className="text-sm font-display font-semibold mt-0.5"
            style={{ color: level.color }}
          >
            {level.label}
          </p>

          {/* Sub-indicator pills */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {sub.map((s) => {
              const subLevel = getLevel(s.score);
              return (
                <span
                  key={s.key}
                  className="inline-flex items-center gap-1.5 text-[11px] font-display font-medium px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subLevel.color }}
                  />
                  {s.label} {s.score}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="mt-4 p-3 rounded-lg bg-bg-tertiary/50">
        <p className="text-xs text-text-secondary leading-relaxed">
          {level.message}
        </p>
      </div>
    </div>
  );
}

export default React.memo(MarketThermometer);
