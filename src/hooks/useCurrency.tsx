'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Currency, loadCurrency, saveCurrency, formatMoney, FormatMoneyOpts } from '@/lib/currency';

interface CurrencyContextValue {
  currency: Currency;
  rate: number | null;
  toggle: () => void;
  setCurrency: (c: Currency) => void;
  format: (usd: number, opts?: FormatMoneyOpts) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

interface ProviderProps {
  rate: number | null;
  children: ReactNode;
}

export function CurrencyProvider({ rate, children }: ProviderProps) {
  const [currency, setCurrencyState] = useState<Currency>('USD');

  useEffect(() => {
    setCurrencyState(loadCurrency());
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    saveCurrency(c);
  }, []);

  const toggle = useCallback(() => {
    setCurrencyState((prev) => {
      const next: Currency = prev === 'USD' ? 'KRW' : 'USD';
      saveCurrency(next);
      return next;
    });
  }, []);

  const format = useCallback(
    (usd: number, opts?: FormatMoneyOpts) => formatMoney(usd, currency, rate, opts),
    [currency, rate],
  );

  const value = useMemo(
    () => ({ currency, rate, toggle, setCurrency, format }),
    [currency, rate, toggle, setCurrency, format],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Fallback for components rendered outside provider (e.g., SSR/loading states)
    return {
      currency: 'USD',
      rate: null,
      toggle: () => {},
      setCurrency: () => {},
      format: (usd) => formatMoney(usd, 'USD', null),
    };
  }
  return ctx;
}
