'use client';

import React, { useMemo } from 'react';
import { FearGreedData, VIXData, MacroItem } from '@/lib/types';
import { clamp, getScoreLevel } from '@/lib/utils';
import { useTheme, isNordic } from '@/hooks/useTheme';

interface Props {
  fearGreed: FearGreedData | null;
  vix: VIXData | null;
  macro: MacroItem[];
  loading: boolean;
}

const LEVEL_MESSAGES: Record<string, string> = {
  '극한': '극심한 공포 구간. 시장이 얼어붙었습니다. 역사적으로 저가 매수 기회가 될 수 있습니다.',
  '냉각': '시장이 위축되어 있습니다. 리스크 회피 심리가 지배적입니다.',
  '서늘': '다소 냉각된 시장. 경계심이 있으나 안정적인 구간입니다.',
  '적정': '시장 온도가 적정 수준입니다. 균형 잡힌 심리 상태입니다.',
  '온기': '낙관론이 확산되고 있습니다. 과열 신호에 주의하세요.',
  '과열': '시장이 과열되고 있습니다. 신규 진입 시 주의가 필요합니다.',
  '극과열': '극단적 탐욕 구간. 시장이 끓고 있습니다. 리스크 관리에 집중하세요.',
};

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
    const normalized = 100 - (clamp(vix.value, 10, 40) - 10) / 30 * 100;
    entries.push({ weight: 30, score: Math.round(normalized), label: 'VIX', key: 'vix' });
  }

  const tnx = macro.find((m) => m.symbol === '^TNX');
  if (tnx) {
    const normalized = 50 - (clamp(tnx.changePercent, -3, 3) / 3) * 50;
    entries.push({ weight: 15, score: Math.round(normalized), label: 'TNX', key: 'tnx' });
  }

  const dxy = macro.find((m) => m.symbol === 'DX-Y.NYB');
  if (dxy) {
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

function MarketThermometerNordic({
  result,
}: {
  result: { composite: number; sub: { label: string; key: string; score: number }[] };
}) {
  const { composite, sub } = result;
  const theme = useTheme();
  const level = getScoreLevel(composite, theme);
  const filledCells = Math.round(composite / 5); // 20 cells total (0-100 / 5)

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--text-primary)' }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
      }}>
        Market Temperature
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
        <span style={{
          fontSize: '38px',
          fontWeight: 300,
          letterSpacing: '-0.03em',
          lineHeight: 0.9,
          fontFamily: 'Inter Tight, sans-serif',
          color: 'var(--accent-amber)',
        }}>
          {composite}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-secondary)' }}>° / 100</span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          color: 'var(--accent-amber)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}>
          {level.label}
        </span>
      </div>

      {/* 20-cell segmented meter */}
      <div style={{
        height: '8px',
        border: '1px solid var(--text-primary)',
        display: 'flex',
      }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRight: i < 19 ? '1px solid var(--bg-tertiary)' : undefined,
              background: i < filledCells ? 'var(--text-primary)' : 'transparent',
            }}
          />
        ))}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '8px',
        color: 'var(--text-secondary)',
        marginTop: '4px',
      }}>
        <span>0 · Cold</span>
        <span>50</span>
        <span>Hot · 100</span>
      </div>

      {/* Sub-indicator pills */}
      <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' as const }}>
        {sub.map((s) => (
          <span
            key={s.key}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              padding: '2px 7px',
              border: '1px solid var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            {s.label} {s.score}
          </span>
        ))}
      </div>
    </div>
  );
}

function MarketThermometer({ fearGreed, vix, macro, loading }: Props) {
  const theme = useTheme();
  const nordic = isNordic(theme);
  const result = useMemo(() => computeScore(fearGreed, vix, macro), [fearGreed, vix, macro]);

  if (loading || !result) {
    if (nordic) {
      return (
        <div style={{ padding: '10px 0', borderBottom: '1px solid var(--text-primary)' }}>
          <div style={{ height: '9px', width: '120px', background: 'var(--bg-tertiary)', marginBottom: '10px' }} />
          <div style={{ height: '38px', width: '80px', background: 'var(--bg-tertiary)' }} />
        </div>
      );
    }
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

  if (nordic) {
    return <MarketThermometerNordic result={result} />;
  }

  const { composite, sub } = result;
  const level = getScoreLevel(composite);
  const mercuryPercent = composite;

  const cx = 30;
  const tubeW = 16;
  const tubeR = tubeW / 2;
  const tubeTop = 12;
  const tubeBot = 130;
  const tubeH = tubeBot - tubeTop;
  const bulbR = 14;
  const bulbCY = tubeBot + bulbR - 2;
  const mercuryH = (mercuryPercent / 100) * tubeH;
  const mercuryTop = tubeBot - mercuryH;

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

      <div className="flex gap-5">
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
            <path d={outerPath} fill="var(--bg-tertiary)" />
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
            <circle
              cx={cx}
              cy={bulbCY}
              r={bulbR - 5}
              fill={level.color}
              opacity="0.4"
              style={{ filter: `drop-shadow(0 0 10px ${level.color})` }}
            />
            {ticks.map((t) => {
              const y = tubeBot - (t / 100) * tubeH;
              return (
                <g key={t}>
                  <line x1={cx + tubeR + 3} y1={y} x2={cx + tubeR + 8} y2={y} stroke="var(--text-dim)" strokeWidth="1" />
                  <text x={cx + tubeR + 11} y={y + 3} fill="var(--text-dim)" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    {t}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

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

          <div className="flex flex-wrap gap-1.5 mt-4">
            {sub.map((s) => {
              const subLevel = getScoreLevel(s.score);
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

      <div className="mt-4 p-3 rounded-lg bg-bg-tertiary/50">
        <p className="text-xs text-text-secondary leading-relaxed">
          {LEVEL_MESSAGES[level.label]}
        </p>
      </div>
    </div>
  );
}

export default React.memo(MarketThermometer);
