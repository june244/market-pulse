'use client';

import { MacroItem } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  macro: MacroItem[];
  loading: boolean;
}

export default function MacroDashboard({ macro, loading }: Props) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 mb-4 opacity-0 animate-fade-in stagger-1">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[120px] h-[68px] bg-bg-secondary rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (macro.length === 0) return null;

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
