'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  tickers: string[];
  onUpdate: (tickers: string[]) => void;
}

export default function TickerEditor({ tickers, onUpdate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Portal mount guard
  useEffect(() => { setMounted(true); }, []);

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const addTicker = useCallback(() => {
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;

    if (tickers.includes(ticker)) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput('');
      return;
    }

    onUpdate([...tickers, ticker]);
    setJustAdded(ticker);
    setTimeout(() => setJustAdded(null), 700);
    setInput('');
  }, [input, tickers, onUpdate]);

  const removeTicker = (symbol: string) => {
    onUpdate(tickers.filter((t) => t !== symbol));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addTicker(); }
    if (e.key === 'Escape') setIsOpen(false);
  };

  const panel = isOpen && mounted ? createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-[2px] ticker-editor-backdrop-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div
        className="fixed z-[9999] right-3 top-14 w-[calc(100vw-1.5rem)] sm:right-4 sm:top-16 sm:w-80 ticker-editor-panel-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#13131f]/95 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
              <span className="font-display text-[11px] font-medium text-text-secondary uppercase tracking-[0.15em]">
                Watchlist
              </span>
              {tickers.length > 0 && (
                <span className="text-[10px] font-display text-text-dim tabular-nums">
                  {tickers.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 -mr-1 rounded-lg text-text-dim hover:text-text-primary hover:bg-white/[0.05] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Input */}
          <div className="p-3 pb-2">
            <div className={`flex gap-2 ${shake ? 'ticker-editor-shake' : ''}`}>
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z.^-]/g, '').slice(0, 10))}
                  onKeyDown={handleKeyDown}
                  placeholder="AAPL"
                  className="w-full bg-white/[0.04] rounded-xl px-3.5 py-3 text-sm font-display text-text-primary font-medium tracking-widest uppercase placeholder:text-text-dim/30 placeholder:tracking-normal placeholder:normal-case border border-white/[0.05] focus:border-accent-blue/30 focus:bg-white/[0.06] focus:outline-none transition-all duration-200"
                />
                {input && (
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-text-dim/50 font-display border border-white/[0.06] rounded px-1 py-0.5">
                    ENTER
                  </kbd>
                )}
              </div>
              <button
                onClick={addTicker}
                disabled={!input.trim()}
                className="px-4 rounded-xl bg-accent-blue/10 text-accent-blue font-display text-sm font-bold hover:bg-accent-blue/20 active:scale-95 transition-all duration-150 disabled:opacity-15 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                +
              </button>
            </div>
          </div>

          {/* Ticker chips */}
          <div className="px-3 pb-3 max-h-52 overflow-y-auto">
            {tickers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tickers.map((t) => (
                  <button
                    key={t}
                    onClick={() => removeTicker(t)}
                    className={`group flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-display font-medium tracking-wider transition-all duration-200 active:scale-95
                      ${justAdded === t
                        ? 'bg-accent-green/12 text-accent-green border border-accent-green/20'
                        : 'bg-white/[0.04] text-text-secondary border border-transparent hover:bg-accent-red/10 hover:text-accent-red hover:border-accent-red/15'
                      }`}
                  >
                    {t}
                    <svg
                      width="10" height="10" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      className="ml-0.5 opacity-25 group-hover:opacity-100 transition-opacity"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-dim/30">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <p className="text-[11px] text-text-dim/60 font-display">
                  티커를 추가해주세요
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {tickers.length > 0 && (
            <div className="px-3 py-2 border-t border-white/[0.03]">
              <p className="text-[9px] text-text-dim/40 font-display text-center tracking-wider uppercase">
                tap to remove
              </p>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center gap-2 px-3 py-2 rounded-lg font-display text-xs tracking-wide transition-all duration-200 ${
          isOpen
            ? 'bg-accent-blue/12 text-accent-blue border border-accent-blue/20'
            : 'bg-bg-tertiary text-text-secondary border border-transparent hover:bg-bg-tertiary/80 hover:text-text-primary'
        }`}
      >
        <svg
          width="13" height="13" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        편집
      </button>
      {panel}
    </>
  );
}
