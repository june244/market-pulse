'use client';

import { useState, useEffect } from 'react';
import { Theme } from '@/lib/utils';

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('nordic');

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || 'nordic';
    setTheme(current);

    const observer = new MutationObserver(() => {
      setTheme((document.documentElement.dataset.theme as Theme) || 'nordic');
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
