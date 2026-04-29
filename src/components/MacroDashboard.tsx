'use client';

import React from 'react';
import { MacroItem } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { useTheme, isNordic } from '@/hooks/useTheme';

interface Props {
  macro: MacroItem[];
  loading: boolean;
}

function MacroDashboard({ macro, loading }: Props) {
  const theme = useTheme();
  const nordic = isNordic(theme);

  if (loading) {
    if (nordic) {
      return (
        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: '14px', width: '48px', background: 'var(--bg-tertiary)' }} />
          ))}
        </div>
      );
    }
    return (
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 mb-4 opacity-0 animate-fade-in stagger-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="shrink-0 w-[120px] h-[68px] bg-bg-secondary rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (macro.length === 0) return null;

  if (nordic) {
    return (
      <div style={{
        padding: '8px 0',
        borderBottom: '1px solid var(--text-primary)',
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        flexWrap: 'wrap' as const,
        gap: '4px',
      }}>
        {macro.map((m) => {
          const isUp = m.change >= 0;
          const isYield = m.symbol === '^TNX';
          return (
            <span key={m.symbol}>
              <b style={{ color: 'var(--text-primary)', marginRight: '3px' }}>{m.label}</b>
              <i style={{
                fontStyle: 'normal',
                color: isUp ? 'var(--accent-green)' : 'var(--accent-red)',
              }}>
                {isUp ? '+' : ''}{formatNumber(m.changePercent)}%
              </i>
              {isYield && (
                <i style={{ fontStyle: 'normal', color: 'var(--text-secondary)', marginLeft: '3px' }}>
                  {formatNumber(m.price)}
                </i>
              )}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 mb-4 opacity-0 animate-fade-in stagger-1">
      {macro.map((m) => {
        const isUp = m.change >= 0;
        const isYield = m.symbol === '^TNX';

        return (
          <div
            key={m.symbol}
            className="shrink-0 bg-bg-secondary rounded-xl px-3.5 py-2.5 card-hover min-w-[120px]"
          >
            <span className="text-[11px] text-text-dim font-display block leading-tight">
              {m.label}
            </span>
            <span className="font-display font-semibold text-sm text-text-primary leading-tight mt-0.5 block">
              {isYield ? '' : '$'}{formatNumber(m.price)}
            </span>
            <span
              className={`text-[11px] font-display font-semibold leading-tight mt-0.5 block ${
                isUp ? 'text-accent-green' : 'text-accent-red'
              }`}
            >
              {isUp ? '+' : ''}{formatNumber(m.changePercent)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(MacroDashboard);
