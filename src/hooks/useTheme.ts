'use client';

import { useState, useEffect } from 'react';
import { Theme } from '@/lib/utils';

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || 'dark';
    setTheme(current);

    const observer = new MutationObserver(() => {
      setTheme((document.documentElement.dataset.theme as Theme) || 'dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export function isNordic(theme: Theme): boolean {
  return theme === 'nordic' || theme === 'nordic-light';
}
