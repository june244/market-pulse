'use client';

import React from 'react';
import { FearGreedData } from '@/lib/types';
import { getSentimentLevel, getSentimentLabel, getSentimentLabelKR, getSentimentColor } from '@/lib/utils';

interface Props {
  data: FearGreedData | null;
  loading: boolean;
}

function FearGreedGauge({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-4 sm:p-6 card-hover animate-pulse">
        <div className="h-6 w-40 bg-bg-tertiary rounded mb-6" />
        <div className="flex justify-center">
          <div className="w-48 h-48 rounded-full bg-bg-tertiary" />
        </div>
      </div>
    );
  }

  const level = getSentimentLevel(data.score);
  const color = getSentimentColor(level);
  const labelEN = getSentimentLabel(level);
  const labelKR = getSentimentLabelKR(level);

  // SVG gauge: 270 degree arc
  const radius = 80;
  const cx = 100;
  const cy = 100;
  const startAngle = -225;
  const endAngle = 45;
  const totalAngle = endAngle - startAngle; // 270
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
            stroke="#1a1a28"
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
          <text x={cx} y={cy + 16} textAnchor="middle" fill="#8888a0" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">
            {labelKR}
          </text>
          <text x="18" y="130" fill="#555570" fontSize="9" fontFamily="JetBrains Mono">0</text>
          <text x="172" y="130" fill="#555570" fontSize="9" fontFamily="JetBrains Mono">100</text>
        </svg>
      </div>
    </div>
  );
}

export default React.memo(FearGreedGauge);
