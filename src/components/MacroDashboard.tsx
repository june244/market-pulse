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
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--text-primary)' }}>
          <div style={{ height: '9px', width: '90px', background: 'var(--bg-tertiary)', marginBottom: '10px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ padding: '8px 6px', height: '50px', background: 'var(--bg-tertiary)', margin: '2px' }} />
            ))}
          </div>
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
      <div style={{ padding: '12px 0', borderBottom: '1px solid var(--text-primary)' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '10px',
        }}>
          Macro Indicators
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          border: '1px solid var(--bg-tertiary)',
        }}>
          {macro.map((m, i) => {
            const isUp = m.change >= 0;
            const isYield = m.symbol === '^TNX';
            const col = i % 3;
            const row = Math.floor(i / 3);
            const totalRows = Math.ceil(macro.length / 3);
            return (
              <div
                key={m.symbol}
                style={{
                  padding: '8px 10px',
                  borderRight: col < 2 ? '1px solid var(--bg-tertiary)' : 'none',
                  borderBottom: row < totalRows - 1 ? '1px solid var(--bg-tertiary)' : 'none',
                  minWidth: 0,
                }}
              >
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9px',
                  letterSpacing: '0.15em',
                  color: 'var(--text-dim)',
                  marginBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {m.label}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '4px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: isUp ? 'var(--accent-green)' : 'var(--accent-red)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {isUp ? '+' : ''}{formatNumber(m.changePercent)}%
                  </span>
                  {isYield && (
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(m.price)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
