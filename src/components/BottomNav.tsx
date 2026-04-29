'use client';

import React from 'react';
import { useTheme, isNordic } from '@/hooks/useTheme';

type Tab = 'dashboard' | 'coin' | 'watchlist' | 'calendar';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; nordicLabel: string; icon: JSX.Element }[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    nordicLabel: 'Pulse',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'coin',
    label: '코인',
    nordicLabel: 'Market',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M14.5 9h-3a1.5 1.5 0 000 3h1a1.5 1.5 0 010 3h-3" />
        <path d="M12 6.5v1m0 9v1" />
      </svg>
    ),
  },
  {
    id: 'watchlist',
    label: '워치리스트',
    nordicLabel: 'Folio',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: '캘린더',
    nordicLabel: 'Cal',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <rect x="8" y="14" width="2" height="2" rx="0.5" />
        <rect x="14" y="14" width="2" height="2" rx="0.5" />
        <rect x="8" y="18" width="2" height="2" rx="0.5" />
      </svg>
    ),
  },
];

function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const theme = useTheme();
  const nordic = isNordic(theme);

  if (nordic) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          borderTop: '1px solid var(--text-primary)',
          background: 'var(--bg-primary)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ display: 'flex' }}>
          {tabs.map((tab, i) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 0 14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--text-primary)' : 'transparent',
                  borderRight: i < tabs.length - 1 ? '1px solid var(--text-primary)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderTop: i < tabs.length - 1 ? undefined : 'none',
                  borderLeft: 'none',
                  borderBottom: 'none',
                  borderRightWidth: i < tabs.length - 1 ? '1px' : '0',
                  borderRightStyle: 'solid' as const,
                  borderRightColor: 'var(--text-primary)',
                }}
              >
                {tab.nordicLabel}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-bg-tertiary bg-bg-secondary/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
              activeTab === tab.id ? 'text-accent-green' : 'text-text-dim'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-display font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default React.memo(BottomNav);
