'use client';

import React from 'react';
import { VIXData } from '@/lib/types';
import { getVIXLevel, formatNumber } from '@/lib/utils';

interface Props {
  data: VIXData | null;
  loading: boolean;
}

function VIXCard({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-6 card-hover animate-pulse">
        <div className="h-6 w-32 bg-bg-tertiary rounded mb-4" />
        <div className="h-12 w-24 bg-bg-tertiary rounded" />
      </div>
    );
  }

  const vixInfo = getVIXLevel(data.value);
  const isUp = data.change >= 0;

  // VIX bar visualization
  const maxVIX = 80;
  const barPercent = Math.min((data.value / maxVIX) * 100, 100);

  return (
    <div className="bg-bg-secondary rounded-2xl p-6 card-hover opacity-0 animate-fade-in stagger-1">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-sm font-medium tracking-wider text-text-secondary uppercase">
          CBOE VIX
        </h2>
        <span
          className="text-xs font-display font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${vixInfo.color}18`, color: vixInfo.color }}
        >
          {vixInfo.labelKR}
        </span>
      </div>
      <p className="text-[11px] text-text-dim mb-4">S&amp;P 500 내재 변동성 (30일)</p>

      <div className="flex items-end gap-3 mb-5">
        <span
          className="text-5xl font-display font-bold tracking-tight"
          style={{ color: vixInfo.color }}
        >
          {formatNumber(data.value)}
        </span>
        <div className="flex flex-col items-start mb-1.5">
          <span
            className={`text-sm font-display font-medium ${
              isUp ? 'text-accent-red' : 'text-accent-green'
            }`}
          >
            {isUp ? '▲' : '▼'} {formatNumber(Math.abs(data.change))}
          </span>
          <span className="text-xs text-text-dim font-display">
            ({isUp ? '+' : ''}{formatNumber(data.changePercent)}%)
          </span>
        </div>
      </div>

      {/* VIX bar */}
      <div className="relative">
        <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${barPercent}%`,
              background: `linear-gradient(90deg, #00ff87, #ffaa00, #ff3366)`,
              filter: `drop-shadow(0 0 4px ${vixInfo.color}88)`,
            }}
          />
        </div>
        {/* Scale markers */}
        <div className="flex justify-between mt-1.5">
          {[0, 12, 20, 30, 50, 80].map((v) => (
            <span key={v} className="text-[9px] text-text-dim font-display">
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <div className="mt-4 p-3 rounded-lg bg-bg-tertiary/50">
        <p className="text-xs text-text-secondary leading-relaxed">
          {data.value < 15 && '시장 안정. 투자자들이 위험을 감수하는 상태.'}
          {data.value >= 15 && data.value < 20 && '보통 수준의 변동성. 경계는 필요하지만 패닉은 아님.'}
          {data.value >= 20 && data.value < 30 && '불안감 상승. 헤지 수요 증가 구간.'}
          {data.value >= 30 && '공포 확산. 역사적으로 과매도 구간 진입 가능성.'}
        </p>
      </div>
    </div>
  );
}

export default React.memo(VIXCard);
