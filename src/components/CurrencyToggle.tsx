'use client';

import { useCurrency } from '@/hooks/useCurrency';

export default function CurrencyToggle() {
  const { currency, toggle, rate } = useCurrency();

  const label = currency === 'USD' ? 'USD' : 'KRW';
  const title =
    rate && rate > 0
      ? `통화 전환 (1 USD = ${Math.round(rate).toLocaleString('en-US')} KRW)`
      : '통화 전환 (환율 불러오는 중)';

  return (
    <button
      onClick={toggle}
      title={title}
      style={{
        background: 'transparent',
        border: '1px solid var(--text-secondary)',
        height: '24px',
        padding: '0 8px',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}
