'use client';

import React, { useState } from 'react';
import { Trade } from '@/lib/types';
import { formatNumber, calcPosition } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatMoney } from '@/lib/currency';

interface Props {
  symbol: string;
  currentPrice: number;
  trades: Trade[];
  onAddTrade: (symbol: string, trade: Trade) => void;
  onDeleteTrade: (symbol: string, tradeId: string) => void;
}

export default function TradeManager({ symbol, currentPrice, trades, onAddTrade, onDeleteTrade }: Props) {
  const { format, currency } = useCurrency();
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  const position = calcPosition(trades);
  const { avgCost, totalQty, realizedPL } = position;
  const unrealizedPL = totalQty > 0 ? (currentPrice - avgCost) * totalQty : 0;
  const returnPct = avgCost > 0 && totalQty > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

  const sortedTrades = [...trades].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const displayTrades = showAll ? sortedTrades : sortedTrades.slice(0, 5);

  const handleSave = () => {
    const p = parseFloat(price);
    const q = parseFloat(quantity);
    if (!p || p <= 0 || !q || q <= 0) return;

    const trade: Trade = {
      id: crypto.randomUUID(),
      type: tradeType,
      date,
      price: p,
      quantity: q,
    };
    onAddTrade(symbol, trade);
    setPrice('');
    setQuantity('');
    setShowForm(false);
  };

  const handleCancel = () => {
    setPrice('');
    setQuantity('');
    setShowForm(false);
  };

  return (
    <div className="pt-3 border-t border-bg-tertiary/50 space-y-3" onClick={(e) => e.stopPropagation()}>
      {/* Position summary */}
      {totalQty > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="min-w-0">
            <span className="text-[11px] text-text-dim font-display block mb-0.5">평균단가</span>
            <span className="text-sm font-display font-semibold text-text-primary block truncate tabular-nums">
              {format(avgCost)}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-text-dim font-display block mb-0.5">보유수량</span>
            <span className="text-sm font-display font-semibold text-text-primary block truncate tabular-nums">
              {formatNumber(totalQty, totalQty % 1 === 0 ? 0 : 4)}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-text-dim font-display block mb-0.5">평가손익</span>
            <span className={`text-sm font-display font-bold block truncate tabular-nums ${unrealizedPL >= 0 ? 'text-accent-blue' : 'text-accent-red'}`}>
              {format(unrealizedPL, { signed: true })}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-text-dim font-display block mb-0.5">수익률</span>
            <span className={`text-sm font-display font-bold block truncate tabular-nums ${returnPct >= 0 ? 'text-accent-blue' : 'text-accent-red'}`}>
              {returnPct >= 0 ? '+' : ''}{formatNumber(returnPct)}%
            </span>
          </div>
        </div>
      )}

      {realizedPL !== 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-dim font-display shrink-0">실현손익</span>
          <span className={`text-xs font-display font-bold truncate tabular-nums ${realizedPL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {format(realizedPL, { signed: true })}
          </span>
        </div>
      )}

      {/* Add trade button / form */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px dashed var(--bg-tertiary)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          + 거래 추가
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', border: '1px solid var(--bg-tertiary)' }}>
          {/* Buy/Sell toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--bg-tertiary)' }}>
            <button
              type="button"
              onClick={() => setTradeType('buy')}
              style={{
                flex: 1,
                padding: '6px',
                border: 'none',
                background: tradeType === 'buy' ? 'var(--accent-green)' : 'transparent',
                color: tradeType === 'buy' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRight: '1px solid var(--bg-tertiary)',
              }}
            >
              매수
            </button>
            <button
              type="button"
              onClick={() => setTradeType('sell')}
              style={{
                flex: 1,
                padding: '6px',
                border: 'none',
                background: tradeType === 'sell' ? 'var(--accent-red)' : 'transparent',
                color: tradeType === 'sell' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              매도
            </button>
          </div>

          {/* Date */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid var(--bg-tertiary)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              outline: 'none',
            }}
          />

          {/* Price + Quantity */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <span style={{
                position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
                color: 'var(--text-secondary)',
                pointerEvents: 'none',
              }}>$</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="가격 (USD)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  paddingLeft: '20px',
                  paddingRight: '8px',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  border: '1px solid var(--bg-tertiary)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="수량"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                boxSizing: 'border-box',
                padding: '6px 8px',
                border: '1px solid var(--bg-tertiary)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                outline: 'none',
              }}
            />
          </div>
          {currency === 'KRW' && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
            }}>거래 가격은 USD 기준으로 입력하세요</span>
          )}

          {/* Save / Cancel */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '7px',
                border: '1px solid var(--text-primary)',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: '7px',
                border: '1px solid var(--bg-tertiary)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Trade history */}
      {sortedTrades.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] text-text-dim font-display block">거래 내역</span>
          {displayTrades.map((trade) => (
            <div key={trade.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-bg-tertiary/30 transition-colors">
              <span className="text-[11px] text-text-dim font-display shrink-0">{trade.date}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-display font-bold shrink-0 ${
                  trade.type === 'buy'
                    ? 'bg-accent-green/15 text-accent-green'
                    : 'bg-accent-red/15 text-accent-red'
                }`}
              >
                {trade.type === 'buy' ? '매수' : '매도'}
              </span>
              <span className="text-xs font-display text-text-primary tabular-nums truncate">{formatMoney(trade.price, 'USD', null)}</span>
              <span className="text-xs font-display text-text-secondary tabular-nums shrink-0">&times;{formatNumber(trade.quantity, trade.quantity % 1 === 0 ? 0 : 4)}</span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => onDeleteTrade(symbol, trade.id)}
                className="text-text-dim hover:text-accent-red transition-colors p-0.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {sortedTrades.length > 5 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-[11px] font-display text-accent-blue hover:text-accent-blue/80 transition-colors pl-2"
            >
              더보기 ({sortedTrades.length - 5}건)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
