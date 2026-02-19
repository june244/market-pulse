'use client';

import React, { useState } from 'react';
import { Trade } from '@/lib/types';
import { formatNumber, calcPosition } from '@/lib/utils';

interface Props {
  symbol: string;
  currentPrice: number;
  trades: Trade[];
  onAddTrade: (symbol: string, trade: Trade) => void;
  onDeleteTrade: (symbol: string, tradeId: string) => void;
}

export default function TradeManager({ symbol, currentPrice, trades, onAddTrade, onDeleteTrade }: Props) {
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
          <div>
            <span className="text-[11px] text-text-dim font-display block mb-0.5">평균단가</span>
            <span className="text-sm font-display font-semibold text-text-primary">
              ${formatNumber(avgCost)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-text-dim font-display block mb-0.5">보유수량</span>
            <span className="text-sm font-display font-semibold text-text-primary">
              {formatNumber(totalQty, totalQty % 1 === 0 ? 0 : 4)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-text-dim font-display block mb-0.5">평가손익</span>
            <span className={`text-sm font-display font-bold ${unrealizedPL >= 0 ? 'text-accent-blue' : 'text-accent-red'}`}>
              {unrealizedPL >= 0 ? '+' : ''}{formatNumber(unrealizedPL)}$
            </span>
          </div>
          <div>
            <span className="text-[11px] text-text-dim font-display block mb-0.5">수익률</span>
            <span className={`text-sm font-display font-bold ${returnPct >= 0 ? 'text-accent-blue' : 'text-accent-red'}`}>
              {returnPct >= 0 ? '+' : ''}{formatNumber(returnPct)}%
            </span>
          </div>
        </div>
      )}

      {realizedPL !== 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-dim font-display">실현손익</span>
          <span className={`text-xs font-display font-bold ${realizedPL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {realizedPL >= 0 ? '+' : ''}{formatNumber(realizedPL)}$
          </span>
        </div>
      )}

      {/* Add trade button / form */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full py-2 rounded-lg border border-dashed border-bg-tertiary text-xs font-display font-medium text-text-secondary hover:border-accent-blue/40 hover:text-accent-blue transition-colors"
        >
          + 거래 추가
        </button>
      ) : (
        <div className="space-y-2 bg-bg-primary/50 rounded-lg p-3">
          {/* Buy/Sell toggle */}
          <div className="flex rounded-lg overflow-hidden border border-bg-tertiary">
            <button
              type="button"
              onClick={() => setTradeType('buy')}
              className={`flex-1 py-1.5 text-xs font-display font-semibold transition-colors ${
                tradeType === 'buy'
                  ? 'bg-accent-green/20 text-accent-green'
                  : 'text-text-secondary hover:bg-bg-tertiary/30'
              }`}
            >
              매수
            </button>
            <button
              type="button"
              onClick={() => setTradeType('sell')}
              className={`flex-1 py-1.5 text-xs font-display font-semibold transition-colors ${
                tradeType === 'sell'
                  ? 'bg-accent-red/20 text-accent-red'
                  : 'text-text-secondary hover:bg-bg-tertiary/30'
              }`}
            >
              매도
            </button>
          </div>

          {/* Date */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-2 py-1.5 rounded-md bg-bg-primary border border-bg-tertiary text-sm font-display text-text-primary focus:outline-none focus:border-accent-blue/50 transition-colors"
          />

          {/* Price + Quantity */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-dim font-display">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="가격"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-5 pr-2 py-1.5 rounded-md bg-bg-primary border border-bg-tertiary text-sm font-display text-text-primary placeholder:text-text-dim/50 focus:outline-none focus:border-accent-blue/50 transition-colors"
              />
            </div>
            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="수량"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-bg-primary border border-bg-tertiary text-sm font-display text-text-primary placeholder:text-text-dim/50 focus:outline-none focus:border-accent-blue/50 transition-colors"
              />
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-1.5 rounded-lg bg-accent-blue text-white text-xs font-display font-semibold hover:bg-accent-blue/80 transition-colors"
            >
              저장
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-1.5 rounded-lg bg-bg-tertiary text-text-secondary text-xs font-display font-semibold hover:bg-bg-tertiary/80 transition-colors"
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
              <span className="text-xs font-display text-text-primary">${formatNumber(trade.price)}</span>
              <span className="text-xs font-display text-text-secondary">&times;{formatNumber(trade.quantity, trade.quantity % 1 === 0 ? 0 : 4)}</span>
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
