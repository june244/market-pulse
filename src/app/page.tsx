'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MarketData } from '@/lib/types';
import { DEFAULT_TICKERS, loadTickers, saveTickers, formatTimestamp } from '@/lib/utils';
import FearGreedGauge from '@/components/FearGreedGauge';
import VIXCard from '@/components/VIXCard';
import MacroDashboard from '@/components/MacroDashboard';
import TickerTable from '@/components/TickerTable';
import TickerEditor from '@/components/TickerEditor';
import BottomNav from '@/components/BottomNav';

const CoinTab = dynamic(() => import('@/components/CoinTab'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-bg-secondary rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="animate-pulse bg-bg-tertiary rounded h-6 w-24" />
            <div className="animate-pulse bg-bg-tertiary rounded h-6 w-32" />
          </div>
          <div className="animate-pulse bg-bg-tertiary rounded-xl h-[200px] mb-4" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="animate-pulse bg-bg-tertiary rounded-lg h-14 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
});

type Tab = 'dashboard' | 'coin' | 'watchlist';
const TABS: Tab[] = ['dashboard', 'coin', 'watchlist'];
const REFRESH_INTERVAL = 60_000; // 1 minute

export default function Home() {
  const [data, setData] = useState<MarketData | null>(null);
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

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
    const interval = setInterval(() => {
      fetchData();
      setRefreshKey((k) => k + 1);
    }, REFRESH_INTERVAL);
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

  // ── Swipe-to-switch tab (mobile only) ──
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeDelta = useRef(0);
  const directionLocked = useRef<'h' | 'v' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 50;
  const LOCK_THRESHOLD = 10;

  const tabIndex = TABS.indexOf(activeTab);
  const maxIndex = TABS.length - 1;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    swipeDelta.current = 0;
    directionLocked.current = null;
    if (trackRef.current) trackRef.current.style.transition = 'none';
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;

    if (!directionLocked.current) {
      if (Math.abs(dx) > LOCK_THRESHOLD || Math.abs(dy) > LOCK_THRESHOLD) {
        directionLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
    }
    if (directionLocked.current !== 'h') return;

    // Clamp: don't swipe past edges
    let clamped = dx;
    if (tabIndex === 0 && dx > 0) clamped = 0;
    if (tabIndex === maxIndex && dx < 0) clamped = 0;
    swipeDelta.current = clamped;

    if (trackRef.current) {
      const base = -tabIndex * 100;
      const pxToPercent = (clamped / window.innerWidth) * 100;
      trackRef.current.style.transform = `translateX(${base + pxToPercent}%)`;
    }
  }, [tabIndex, maxIndex]);

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current) return;
    const dx = swipeDelta.current;
    const elapsed = Date.now() - touchStart.current.time;
    const velocity = Math.abs(dx) / elapsed; // px/ms

    if (trackRef.current) trackRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';

    const shouldSwitch = Math.abs(dx) > SWIPE_THRESHOLD || velocity > 0.4;
    let newIdx = tabIndex;
    if (shouldSwitch && directionLocked.current === 'h') {
      if (dx < 0 && tabIndex < maxIndex) newIdx = tabIndex + 1;
      else if (dx > 0 && tabIndex > 0) newIdx = tabIndex - 1;
    }

    setActiveTab(TABS[newIdx]);

    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${-newIdx * 100}%)`;
    }

    touchStart.current = null;
    swipeDelta.current = 0;
    directionLocked.current = null;
  }, [tabIndex, maxIndex]);

  // Sync track position when tab changes via bottom nav
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
      trackRef.current.style.transform = `translateX(${-tabIndex * 100}%)`;
    }
  }, [tabIndex]);

  return (
    <main className="relative z-10 min-h-screen px-4 py-6 pb-20 md:pb-6 max-w-5xl mx-auto">
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
            onClick={() => { setLoading(true); fetchData(); setRefreshKey((k) => k + 1); }}
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

      {/* ── Mobile swipeable tabs ── */}
      <div
        className="md:hidden overflow-hidden -mx-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{ transform: `translateX(${-tabIndex * 100}%)`, transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}
        >
          {/* Tab 0: Dashboard */}
          <div className="w-full flex-shrink-0 px-4">
            <div className="grid grid-cols-1 gap-4 mb-4">
              <FearGreedGauge data={data?.fearGreed ?? null} loading={loading} />
              <VIXCard data={data?.vix ?? null} loading={loading} />
            </div>
            <MacroDashboard macro={data?.macro ?? []} loading={loading} />
          </div>
          {/* Tab 1: Coin */}
          <div className="w-full flex-shrink-0 px-4">
            <CoinTab refreshKey={refreshKey} />
          </div>
          {/* Tab 2: Watchlist */}
          <div className="w-full flex-shrink-0 px-4">
            <TickerTable tickers={data?.tickers ?? []} loading={loading} tickerOrder={tickers} onReorder={handleTickerUpdate} onDelete={handleDeleteTicker} />
          </div>
        </div>
      </div>

      {/* ── Desktop: all content visible (no tabs) ── */}
      <div className="hidden md:block">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <FearGreedGauge data={data?.fearGreed ?? null} loading={loading} />
          <VIXCard data={data?.vix ?? null} loading={loading} />
        </div>
        <MacroDashboard macro={data?.macro ?? []} loading={loading} />
        <CoinTab refreshKey={refreshKey} />
        <div className="mt-4">
          <TickerTable tickers={data?.tickers ?? []} loading={loading} tickerOrder={tickers} onReorder={handleTickerUpdate} onDelete={handleDeleteTicker} />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 pb-4 text-center">
        <p className="text-[10px] text-text-dim font-display">
          데이터: Yahoo Finance (비공식) · CNN Fear &amp; Greed Index (비공식) · 투자 조언이 아닙니다
        </p>
        <p className="text-[10px] text-text-dim font-display mt-1">
          자동 갱신 60초 · 종가 기준 · 실시간 데이터가 아닐 수 있음
        </p>
      </footer>

      {/* Mobile bottom navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
