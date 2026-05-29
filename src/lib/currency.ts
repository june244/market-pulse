export type Currency = 'USD' | 'KRW';

const STORAGE_KEY = 'market-pulse-currency';

export function loadCurrency(): Currency {
  if (typeof window === 'undefined') return 'USD';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'KRW') return 'KRW';
  } catch {}
  return 'USD';
}

export function saveCurrency(c: Currency): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, c);
  } catch {}
}

export interface FormatMoneyOpts {
  // For USD: number of decimals (default 2 for price-like, 0 for total-like via decimals=0)
  decimals?: number;
  // Always show + sign when positive (for P/L)
  signed?: boolean;
  // Show currency symbol prefix (default true)
  symbol?: boolean;
}

/**
 * Format a USD amount in either USD or KRW.
 * If KRW is requested but rate is unavailable, falls back to USD formatting.
 */
export function formatMoney(
  amountUsd: number,
  currency: Currency,
  rate: number | null,
  opts: FormatMoneyOpts = {},
): string {
  const { decimals, signed = false, symbol = true } = opts;
  const sign = signed && amountUsd > 0 ? '+' : amountUsd < 0 ? '-' : '';
  const absUsd = Math.abs(amountUsd);

  if (currency === 'KRW' && rate && rate > 0) {
    const krw = absUsd * rate;
    // KRW: integer formatting
    const formatted = Math.round(krw).toLocaleString('en-US');
    return `${sign}${symbol ? '₩' : ''}${formatted}`;
  }

  const d = decimals ?? 2;
  const formatted = absUsd.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  return `${sign}${symbol ? '$' : ''}${formatted}`;
}
