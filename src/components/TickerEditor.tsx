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

  useEffect(() => { setMounted(true); }, []);

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
        className="fixed inset-0 z-[9998] bg-black/40 ticker-editor-backdrop-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div
        className="fixed z-[9999] right-3 top-14 w-[calc(100vw-1.5rem)] sm:right-4 sm:top-16 sm:w-80 ticker-editor-panel-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--text-primary)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--bg-tertiary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', background: 'var(--text-primary)' }} />
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}>
                Watchlist
              </span>
              {tickers.length > 0 && (
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9px',
                  color: 'var(--text-secondary)',
                }}>
                  {tickers.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Input */}
          <div style={{ padding: '10px 14px 8px' }}>
            <div className={shake ? 'ticker-editor-shake' : ''} style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z.^-]/g, '').slice(0, 10))}
                onKeyDown={handleKeyDown}
                placeholder="AAPL"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  border: '1px solid var(--text-secondary)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  outline: 'none',
                }}
              />
              <button
                onClick={addTicker}
                disabled={!input.trim()}
                style={{
                  padding: '8px 14px',
                  border: '1px solid var(--text-primary)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  cursor: 'pointer',
                  opacity: input.trim() ? 1 : 0.3,
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Ticker chips */}
          <div style={{ padding: '0 14px 14px', maxHeight: '200px', overflowY: 'auto' }}>
            {tickers.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {tickers.map((t) => (
                  <button
                    key={t}
                    onClick={() => removeTicker(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px',
                      border: justAdded === t
                        ? '1px solid var(--accent-green)'
                        : '1px solid var(--bg-tertiary)',
                      background: 'transparent',
                      color: justAdded === t ? 'var(--accent-green)' : 'var(--text-secondary)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '9px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (justAdded !== t) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-red)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-red)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (justAdded !== t) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bg-tertiary)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    {t}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <p style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9px',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  티커를 추가해주세요
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {tickers.length > 0 && (
            <div style={{
              padding: '6px 14px',
              borderTop: '1px solid var(--bg-tertiary)',
              textAlign: 'center',
            }}>
              <p style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '8px',
                color: 'var(--text-secondary)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                opacity: 0.5,
              }}>
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
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '24px',
          padding: '0 10px',
          border: isOpen ? '1px solid var(--text-primary)' : '1px solid var(--text-secondary)',
          background: isOpen ? 'var(--text-primary)' : 'transparent',
          color: isOpen ? 'var(--bg-primary)' : 'var(--text-secondary)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none' }}
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        편집
      </button>
      {panel}
    </>
  );
}
