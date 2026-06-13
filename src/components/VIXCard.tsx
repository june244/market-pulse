'use client';

import React from 'react';
import { VIXData } from '@/lib/types';
import { getVIXLevel, formatNumber } from '@/lib/utils';
import { useTheme, isNordic } from '@/hooks/useTheme';

interface Props {
  data: VIXData | null;
  loading: boolean;
}

function VIXCardNordic({ data }: { data: VIXData }) {
  const vixInfo = getVIXLevel(data.value);
  const isUp = data.change >= 0;
  const maxVIX = 80;
  const barPercent = Math.min((data.value / maxVIX) * 100, 100);

  const interpretation =
    data.value < 15 ? '시장 안정. 투자자들이 위험을 감수하는 상태.' :
    data.value < 20 ? '보통 수준의 변동성. 경계는 필요하지만 패닉은 아님.' :
    data.value < 30 ? '불안감 상승. 헤지 수요 증가 구간.' :
    '공포 확산. 역사적으로 과매도 구간 진입 가능성.';

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--text-primary)' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
      }}>
        <span>CBOE VIX</span>
        <span style={{ color: 'var(--accent-amber)' }}>{vixInfo.labelKR.toUpperCase()}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '8px' }}>
        <span style={{
          fontSize: '34px',
          fontWeight: 300,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          fontFamily: 'Inter Tight, sans-serif',
          color: 'var(--accent-amber)',
        }}>
          {formatNumber(data.value)}
        </span>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', lineHeight: 1.5 }}>
          <span style={{ color: isUp ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {isUp ? '▲' : '▼'} {formatNumber(Math.abs(data.change))}
          </span>
          <br />
          <span style={{ color: 'var(--text-secondary)' }}>
            ({isUp ? '+' : ''}{formatNumber(data.changePercent)}%)
          </span>
        </div>
      </div>

      {/* Bar */}
      <div style={{ height: '3px', background: 'var(--bg-tertiary)', marginBottom: '4px' }}>
        <div style={{ height: '100%', background: 'var(--accent-amber)', width: `${barPercent}%` }} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '8px',
        color: 'var(--text-secondary)',
      }}>
        {[0, 12, 20, 30, 50, 80].map((v) => <span key={v}>{v}</span>)}
      </div>

      {/* Interpretation */}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        color: 'var(--text-secondary)',
        lineHeight: 1.4,
        marginTop: '6px',
        paddingLeft: '8px',
        borderLeft: '1px solid var(--bg-tertiary)',
      }}>
        {interpretation}
      </div>
    </div>
  );
}

function VIXCard({ data, loading }: Props) {
  const theme = useTheme();
  const nordic = isNordic(theme);

  if (loading || !data) {
    if (nordic) {
      return (
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--text-primary)' }}>
          <div style={{ height: '9px', width: '80px', background: 'var(--bg-tertiary)', marginBottom: '10px' }} />
          <div style={{ height: '34px', width: '80px', background: 'var(--bg-tertiary)' }} />
        </div>
      );
    }
    return (
      <div className="bg-bg-secondary rounded-2xl p-4 sm:p-6 card-hover animate-pulse">
        <div className="h-6 w-32 bg-bg-tertiary rounded mb-4" />
        <div className="h-12 w-24 bg-bg-tertiary rounded" />
      </div>
    );
  }

  if (nordic) {
    return <VIXCardNordic data={data} />;
  }

  const vixInfo = getVIXLevel(data.value);
  const isUp = data.change >= 0;
  const maxVIX = 80;
  const barPercent = Math.min((data.value / maxVIX) * 100, 100);

  return (
    <div className="bg-bg-secondary rounded-2xl p-4 sm:p-6 card-hover opacity-0 animate-fade-in stagger-1">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-xs sm:text-sm font-medium tracking-wider text-text-secondary uppercase">
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
          className="text-3xl sm:text-5xl font-display font-bold tracking-tight"
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

      <div className="relative">
        <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${barPercent}%`,
              background: `linear-gradient(90deg, var(--accent-green), var(--accent-amber), var(--accent-red))`,
              filter: `drop-shadow(0 0 4px ${vixInfo.color}88)`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          {[0, 12, 20, 30, 50, 80].map((v) => (
            <span key={v} className="text-[9px] text-text-dim font-display">
              {v}
            </span>
          ))}
        </div>
      </div>

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
