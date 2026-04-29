'use client';

import React from 'react';
import { FearGreedData } from '@/lib/types';
import { getSentimentLevel, getSentimentLabel, getSentimentLabelKR, getSentimentColor } from '@/lib/utils';
import { useTheme, isNordic } from '@/hooks/useTheme';

interface Props {
  data: FearGreedData | null;
  loading: boolean;
}

function FearGreedGaugeNordic({ data }: { data: FearGreedData }) {
  const level = getSentimentLevel(data.score);
  const labelEN = getSentimentLabel(level);

  return (
    <div style={{ borderBottom: '1px solid var(--text-primary)', paddingBottom: '0' }}>
      {/* Hero metric */}
      <div style={{ padding: '14px 0 16px', borderBottom: '1px solid var(--text-primary)' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
        }}>
          Fear &amp; Greed Index
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontSize: '66px', fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 0.88, fontFamily: 'Inter Tight, sans-serif', color: 'var(--text-primary)' }}>
              {data.score}
            </span>
            <sup style={{ fontSize: '20px', color: 'var(--text-secondary)', fontWeight: 400, fontFamily: 'Inter Tight, sans-serif' }}>/100</sup>
          </div>
          <div style={{
            textAlign: 'right',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
          }}>
            <b style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--accent-amber)', fontWeight: 500 }}>
              {labelEN.toUpperCase()}
            </b>
            <span style={{ color: 'var(--text-secondary)' }}>{getSentimentLabelKR(level)}</span>
          </div>
        </div>
      </div>

      {/* Linear scale track */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        gap: '10px',
      }}>
        <span>0</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--text-primary)', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '-5px',
            bottom: '-5px',
            width: '1px',
            background: 'var(--accent-amber)',
            left: `${data.score}%`,
          }} />
        </div>
        <span>100</span>
      </div>
    </div>
  );
}

function FearGreedGauge({ data, loading }: Props) {
  const theme = useTheme();
  const nordic = isNordic(theme);

  if (loading || !data) {
    if (nordic) {
      return (
        <div style={{ borderBottom: '1px solid var(--text-primary)', padding: '14px 0 16px' }}>
          <div style={{ height: '9px', width: '120px', background: 'var(--bg-tertiary)', marginBottom: '12px' }} />
          <div style={{ height: '66px', width: '80px', background: 'var(--bg-tertiary)' }} />
        </div>
      );
    }
    return (
      <div className="bg-bg-secondary rounded-2xl p-4 sm:p-6 card-hover animate-pulse">
        <div className="h-6 w-40 bg-bg-tertiary rounded mb-6" />
        <div className="flex justify-center">
          <div className="w-48 h-48 rounded-full bg-bg-tertiary" />
        </div>
      </div>
    );
  }

  if (nordic) {
    return <FearGreedGaugeNordic data={data} />;
  }

  const level = getSentimentLevel(data.score);
  const color = getSentimentColor(level);
  const labelEN = getSentimentLabel(level);
  const labelKR = getSentimentLabelKR(level);

  const radius = 80;
  const cx = 100;
  const cy = 100;
  const startAngle = -225;
  const endAngle = 45;
  const totalAngle = endAngle - startAngle;
  const scoreAngle = startAngle + (data.score / 100) * totalAngle;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const describeArc = (start: number, end: number) => {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const needle = polarToCartesian(scoreAngle);

  return (
    <div className="bg-bg-secondary rounded-2xl p-4 sm:p-6 card-hover opacity-0 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-xs sm:text-sm font-medium tracking-wider text-text-secondary uppercase">
          Fear &amp; Greed
        </h2>
        <span
          className="text-xs font-display font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {labelEN}
        </span>
      </div>

      <div className="flex flex-col items-center mt-4">
        <svg viewBox="0 0 200 140" className="w-full max-w-56 h-auto">
          <path
            d={describeArc(startAngle, endAngle)}
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff3366" />
              <stop offset="25%" stopColor="#ff6644" />
              <stop offset="50%" stopColor="#ffaa00" />
              <stop offset="75%" stopColor="#88cc44" />
              <stop offset="100%" stopColor="#00ff87" />
            </linearGradient>
          </defs>
          <path
            d={describeArc(startAngle, scoreAngle)}
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="14"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
          <circle
            cx={needle.x}
            cy={needle.y}
            r="6"
            fill={color}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
          <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="36" fontFamily="JetBrains Mono, monospace" fontWeight="700">
            {data.score}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" fill="var(--text-secondary)" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">
            {labelKR}
          </text>
          <text x="18" y="130" fill="var(--text-dim)" fontSize="9" fontFamily="JetBrains Mono">0</text>
          <text x="172" y="130" fill="var(--text-dim)" fontSize="9" fontFamily="JetBrains Mono">100</text>
        </svg>
      </div>
    </div>
  );
}

export default React.memo(FearGreedGauge);
