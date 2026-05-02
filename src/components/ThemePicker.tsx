'use client';

import { Theme } from '@/lib/utils';

interface Props {
  current: Theme;
  onChange: (theme: Theme) => void;
}

export default function ThemePicker({ current, onChange }: Props) {
  const isDark = current !== 'nordic-light';

  return (
    <button
      onClick={() => onChange(isDark ? 'nordic-light' : 'nordic')}
      title={isDark ? 'Light 모드로 전환' : 'Dark 모드로 전환'}
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        padding: '5px 10px',
        border: '1px solid var(--text-secondary)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--text-primary)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--text-secondary)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
      }}
    >
      {isDark ? '◑ Light' : '● Dark'}
    </button>
  );
}
