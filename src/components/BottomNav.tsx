'use client';

type Tab = 'dashboard' | 'watchlist';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/[0.06] bg-bg-secondary/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
            activeTab === 'dashboard' ? 'text-accent-green' : 'text-text-dim'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="text-[10px] font-display font-medium">대시보드</span>
        </button>
        <button
          onClick={() => onTabChange('watchlist')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
            activeTab === 'watchlist' ? 'text-accent-green' : 'text-text-dim'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span className="text-[10px] font-display font-medium">워치리스트</span>
        </button>
      </div>
    </nav>
  );
}
