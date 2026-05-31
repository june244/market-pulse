'use client';

import { useEffect, useState, useCallback } from 'react';
import { subscribeToPush, getSubscriptionStatus, isPushSupported } from '@/lib/pushClient';
import BriefingPrefsModal from './BriefingPrefsModal';

interface BriefResponse {
  text: string;
  generatedAt: string;
  date: string;
  cached: boolean;
}

interface Props {
  symbols: string[];
}

function formatStamp(iso: string): string {
  try {
    const d = new Date(iso);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

export default function DailyBrief({ symbols }: Props) {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<'subscribed' | 'unsubscribed' | 'unsupported' | 'denied' | 'loading'>('loading');
  const [pushBusy, setPushBusy] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const fetchBrief = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const sym = symbols.join(',');
      const url = sym
        ? `/api/daily-brief?symbols=${encodeURIComponent(sym)}${force ? '&force=1' : ''}`
        : `/api/daily-brief${force ? '?force=1' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (res.status === 401 || res.redirected) {
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setBrief(json as BriefResponse);
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchBrief(false);
  }, [fetchBrief]);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushStatus('unsupported');
      return;
    }
    getSubscriptionStatus().then(setPushStatus);
  }, []);

  const handleEnablePush = useCallback(async () => {
    setPushBusy(true);
    const result = await subscribeToPush();
    if (result.ok) {
      setPushStatus('subscribed');
    } else if (result.reason === 'denied') {
      setPushStatus('denied');
    }
    setPushBusy(false);
  }, []);

  const showPushButton =
    pushStatus === 'unsubscribed' || pushStatus === 'denied';

  return (
    <div
      data-no-swipe
      style={{
        padding: '12px 0',
        borderBottom: '1px solid var(--text-primary)',
        marginBottom: '4px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}>
          <span>Daily Brief</span>
          {brief && (
            <span style={{ color: 'var(--text-dim)', letterSpacing: '0.12em' }}>
              · {formatStamp(brief.generatedAt)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setPrefsOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid var(--text-secondary)',
              padding: '3px 7px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '8px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
            title="브리핑 철학 / 종목 내러티브 편집"
          >
            ⚙
          </button>
          <button
            onClick={() => fetchBrief(true)}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid var(--text-secondary)',
              padding: '3px 7px',
              color: 'var(--text-secondary)',
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '8px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: loading ? 0.4 : 1,
            }}
            title="다시 생성"
          >
            ↻
          </button>
        </div>
      </div>

      {loading && !brief && (
        <div style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: '13px',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          minHeight: '60px',
        }}>
          <div className="animate-pulse" style={{ height: '10px', background: 'var(--bg-tertiary)', marginBottom: '8px', width: '92%' }} />
          <div className="animate-pulse" style={{ height: '10px', background: 'var(--bg-tertiary)', marginBottom: '8px', width: '88%' }} />
          <div className="animate-pulse" style={{ height: '10px', background: 'var(--bg-tertiary)', width: '64%' }} />
        </div>
      )}

      {error && !brief && (
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          color: 'var(--accent-red)',
        }}>
          브리핑 생성 실패 · {error}
        </div>
      )}

      {brief && (
        <p style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: '14px',
          lineHeight: 1.65,
          color: 'var(--text-primary)',
          letterSpacing: '-0.005em',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}>
          {brief.text}
        </p>
      )}

      {prefsOpen && (
        <BriefingPrefsModal
          symbols={symbols}
          onClose={() => setPrefsOpen(false)}
          onSaved={() => fetchBrief(true)}
        />
      )}

      {brief && showPushButton && (
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={handleEnablePush}
            disabled={pushBusy || pushStatus === 'denied'}
            style={{
              background: 'transparent',
              border: '1px solid var(--text-secondary)',
              padding: '4px 10px',
              color: 'var(--text-secondary)',
              cursor: pushBusy || pushStatus === 'denied' ? 'not-allowed' : 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              opacity: pushBusy ? 0.5 : 1,
            }}
          >
            {pushStatus === 'denied' ? '알림 차단됨' : pushBusy ? '요청 중…' : '🔔 알림 받기'}
          </button>
        </div>
      )}
    </div>
  );
}
