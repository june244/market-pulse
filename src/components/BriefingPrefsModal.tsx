'use client';

import { useEffect, useState } from 'react';

type NarrativeTag = string;

interface TickerNarrative {
  narrative: NarrativeTag;
  thesis?: string;
  monitoring?: string;
}

interface Prefs {
  philosophy: string;
  narratives: Record<string, TickerNarrative>;
  narrativeOptions: NarrativeTag[];
}

interface Props {
  symbols: string[];
  onClose: () => void;
  onSaved?: () => void;
}

const COMMON_TAGS: NarrativeTag[] = ['AI', 'SPACE', 'COIN', '양자', '반도체', '에너지', '기타'];

export default function BriefingPrefsModal({ symbols, onClose, onSaved }: Props) {
  const [philosophy, setPhilosophy] = useState('');
  const [narratives, setNarratives] = useState<Record<string, TickerNarrative>>({});
  const [options, setOptions] = useState<NarrativeTag[]>(COMMON_TAGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/briefing-prefs', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Prefs = await res.json();
        if (cancelled) return;
        setPhilosophy(data.philosophy || '');
        setNarratives(data.narratives || {});
        if (data.narrativeOptions?.length) setOptions(data.narrativeOptions);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSymbol = (symbol: string, patch: Partial<TickerNarrative>) => {
    setNarratives((prev) => {
      const cur = prev[symbol] || { narrative: '기타' };
      return { ...prev, [symbol]: { ...cur, ...patch } };
    });
  };

  const removeSymbol = (symbol: string) => {
    setNarratives((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/briefing-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ philosophy, narratives }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error || `HTTP ${res.status}`);
      }
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'save failed');
    } finally {
      setSaving(false);
    }
  };

  // Symbols to show: user's current tickers + any symbol that already has a narrative
  const allSymbols = Array.from(new Set([...symbols.map((s) => s.toUpperCase()), ...Object.keys(narratives)])).sort();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-no-swipe
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--text-primary)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '18px',
          fontFamily: 'Inter Tight, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}>Briefing Preferences</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--text-secondary)',
              padding: '2px 8px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '20px 0' }}>불러오는 중…</div>
        ) : (
          <>
            <div style={{ marginBottom: '18px' }}>
              <label style={{
                display: 'block',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}>투자 철학</label>
              <textarea
                value={philosophy}
                onChange={(e) => setPhilosophy(e.target.value)}
                rows={8}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
                placeholder="브리핑이 반영할 투자 철학을 적으세요. 예: 장기 실행력 중심, NAVS+FES 프레임 등."
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{
                display: 'block',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}>종목별 내러티브 & 테제</label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {allSymbols.length === 0 && (
                  <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>등록된 종목이 없습니다.</div>
                )}
                {allSymbols.map((sym) => {
                  const n = narratives[sym] || { narrative: '기타' };
                  const inUserList = symbols.map((s) => s.toUpperCase()).includes(sym);
                  return (
                    <div key={sym} style={{
                      border: '1px solid var(--bg-tertiary)',
                      padding: '8px 10px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          letterSpacing: '0.05em',
                        }}>{sym}{!inUserList && <span style={{ marginLeft: '6px', color: 'var(--text-dim)', fontSize: '9px' }}>(미보유)</span>}</span>
                        <button
                          onClick={() => removeSymbol(sym)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '10px',
                          }}
                        >지우기</button>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                        {options.map((tag) => {
                          const active = n.narrative === tag;
                          return (
                            <button
                              key={tag}
                              onClick={() => updateSymbol(sym, { narrative: tag })}
                              style={{
                                background: active ? 'var(--text-primary)' : 'transparent',
                                color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                border: '1px solid ' + (active ? 'var(--text-primary)' : 'var(--bg-tertiary)'),
                                padding: '3px 8px',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '9px',
                                letterSpacing: '0.1em',
                                cursor: 'pointer',
                              }}
                            >{tag}</button>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={n.thesis || ''}
                        onChange={(e) => updateSymbol(sym, { thesis: e.target.value })}
                        placeholder="테제 (한 줄): 강세/약세 논거"
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          fontFamily: 'Inter Tight, sans-serif',
                          fontSize: '12px',
                          marginBottom: '4px',
                        }}
                      />
                      <input
                        type="text"
                        value={n.monitoring || ''}
                        onChange={(e) => updateSymbol(sym, { monitoring: e.target.value })}
                        placeholder="모니터링 (선택): 이번 분기 검증 포인트"
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          fontFamily: 'Inter Tight, sans-serif',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                color: 'var(--accent-red)',
                marginBottom: '10px',
              }}>저장 실패 · {error}</div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--text-secondary)',
                  padding: '6px 14px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >취소</button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: 'var(--text-primary)',
                  border: '1px solid var(--text-primary)',
                  padding: '6px 14px',
                  color: 'var(--bg-primary)',
                  cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  opacity: saving ? 0.6 : 1,
                }}
              >{saving ? '저장 중…' : '저장'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
