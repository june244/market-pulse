'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarketData } from '@/lib/types';
import { DEFAULT_TICKERS, loadTickers, saveTickers, formatTimestamp } from '@/lib/utils';
import FearGreedGauge from '@/components/FearGreedGauge';
import VIXCard from '@/components/VIXCard';
import MacroDashboard from '@/components/MacroDashboard';
import TickerTable from '@/components/TickerTable';
import TickerEditor from '@/components/TickerEditor';

const REFRESH_INTERVAL = 60_000; // 1 minute

export default function Home() {
  const [data, setData] = useState<MarketData | null>(null);
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  // Load saved tickers from localStorage on mount (overrides defaults)
  useEffect(() => {
    setTickers(loadTickers());
  }, []);

  const fetchData = useCallback(async () => {
    if (tickers.length === 0 && !loading) return;
    try {
      setError(null);
      const tickerStr = tickers.join(',');
      const res = await fetch(`/api/market?tickers=${tickerStr}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MarketData = await res.json();
      setData(json);
      setLastRefresh(formatTimestamp(json.updatedAt));
    } catch (e: any) {
      setError(e.message || 'Failed to fetch data');
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [tickers]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Request persistent storage so iOS/browsers don't evict saved tickers
  useEffect(() => {
    navigator.storage?.persist?.();
  }, []);

  // Register service worker + handle updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      }).catch(console.error);
    }
  }, []);

  const handleTickerUpdate = (newTickers: string[]) => {
    setTickers(newTickers);
    saveTickers(newTickers);
  };

  const handleDeleteTicker = (symbol: string) => {
    const newTickers = tickers.filter((t) => t !== symbol);
    handleTickerUpdate(newTickers);
  };

  return (
    <main className="relative z-10 min-h-screen px-4 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8 opacity-0 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full bg-accent-green animate-pulse-slow"
              style={{ boxShadow: '0 0 8px rgba(0,255,135,0.5)' }}
            />
            Market Pulse
          </h1>
          <p className="text-xs text-text-dim mt-1 font-display">
            시장 심리 대시보드 · Fear &amp; Greed · VIX · Watchlist
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10px] text-text-dim font-display">
              마지막 갱신: {lastRefresh}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/80 transition-colors text-text-secondary"
            title="새로고침"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <TickerEditor tickers={tickers} onUpdate={handleTickerUpdate} />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs font-display">
          ⚠ 데이터 로딩 실패: {error}. 잠시 후 다시 시도합니다.
        </div>
      )}

      {/* Sentiment row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <FearGreedGauge data={data?.fearGreed ?? null} loading={loading} />
        <VIXCard data={data?.vix ?? null} loading={loading} />
      </div>

      {/* Macro dashboard */}
      <MacroDashboard macro={data?.macro ?? []} loading={loading} />

      {/* Ticker table */}
      <TickerTable tickers={data?.tickers ?? []} loading={loading} tickerOrder={tickers} onReorder={handleTickerUpdate} onDelete={handleDeleteTicker} />

      {/* Footer */}
      <footer className="mt-8 pb-4 text-center">
        <p className="text-[10px] text-text-dim font-display">
          데이터: Yahoo Finance (비공식) · CNN Fear &amp; Greed Index (비공식) · 투자 조언이 아닙니다
        </p>
        <p className="text-[10px] text-text-dim font-display mt-1">
          자동 갱신 60초 · 종가 기준 · 실시간 데이터가 아닐 수 있음
        </p>
      </footer>
    </main>
  );
}
