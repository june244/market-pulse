'use client';

import { useState, useEffect, useRef } from 'react';
import { Theme } from '@/lib/utils';

const THEMES: { id: Theme; label: string; color: string }[] = [
  { id: 'dark', label: '다크', color: '#0a0a0f' },
  { id: 'light', label: '라이트', color: '#f5f5f7' },
  { id: 'oled', label: 'OLED', color: '#000000' },
  { id: 'bloomberg', label: '블룸버그', color: '#ff8c00' },
];

interface Props {
  current: Theme;
  onChange: (theme: Theme) => void;
}

export default function ThemePicker({ current, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/80 transition-colors text-text-secondary"
        title="테마 변경"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-bg-secondary border border-bg-tertiary rounded-xl p-2 shadow-xl z-[9999] min-w-[140px]">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { onChange(t.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                current === t.id ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary/50'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-text-dim/30"
                style={{ backgroundColor: t.color }}
              />
              <span className="text-xs font-display font-medium text-text-primary">{t.label}</span>
              {current === t.id && (
                <svg className="w-3 h-3 text-accent-green ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
