'use client';

import { useEffect, useState } from 'react';
import { TickerData } from '@/lib/types';

interface PortfolioRoastProps {
  tickers: TickerData[];
  costBasis: Record<string, number>;
  onClose: () => void;
}

const CLOSING_LINES = [
  '투자는 자기 책임입니다. 근데 이 포트폴리오는 좀... 🫣',
  '워런 버핏도 이건 못 살립니다 💀',
  '그래도 주식 하는 게 어디야... 안 하면 심심하잖아요 🎰',
  '오늘의 교훈: 뇌동매매 금지. 근데 내일도 할 거잖아요 🔄',
  '이 앱 끄고 산책이나 다녀오세요. 진심입니다 🚶',
  '존버는 승리한다... 고 믿고 싶죠? 🤞',
];

export default function PortfolioRoast({ tickers, costBasis, onClose }: PortfolioRoastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  // Generate roast lines
  const lines: string[] = [];

  if (tickers.length === 0) {
    lines.push('워치리스트가 비었습니다... 주식 안 하시면 손해도 없긴 합니다 🤷');
  } else {
    const hasCostBasis = tickers.some((t) => costBasis[t.symbol] != null);
    if (!hasCostBasis) {
      lines.push('평균단가를 하나도 안 적으셨네요. 현실 회피 중이신가요? 🙈');
    }

    for (const t of tickers) {
      const basis = costBasis[t.symbol];
      if (basis != null && basis > 0) {
        const pl = ((t.price - basis) / basis) * 100;
        if (pl < -20) {
          lines.push(`${t.symbol} 평균단가 보니까... 고점에서 풀매수 하셨군요 🪦`);
        } else if (pl < -10) {
          lines.push(`${t.symbol} 존버 중이시죠? 멘탈은 괜찮으신가요? 🫠`);
        } else if (pl > 30) {
          lines.push(`${t.symbol} 수익률 보소... 혹시 미래에서 오셨나요? 🔮`);
        } else if (pl > 10) {
          lines.push(`${t.symbol} 잘하셨는데... 더 살걸 후회되시죠? 😏`);
        }
      }

      if (t.changePercent < -5) {
        lines.push(`${t.symbol} 오늘 ${t.changePercent.toFixed(1)}%... 화장실에서 몰래 울어도 됩니다 🚽`);
      } else if (t.changePercent > 5) {
        lines.push(`${t.symbol} +${t.changePercent.toFixed(1)}%! 오늘 치킨은 당신이 쏘는 거죠? 🍗`);
      }
    }

    // All red / all green today
    if (tickers.length > 0) {
      const allRed = tickers.every((t) => t.changePercent < 0);
      const allGreen = tickers.every((t) => t.changePercent > 0);
      if (allRed) {
        lines.push('전부 빨간불이네요... 오늘은 그냥 앱을 닫으세요 📴');
      } else if (allGreen) {
        lines.push('전부 초록불! 로또도 사세요 오늘 운 좋은 날 🍀');
      }
    }
  }

  // Random closing line
  const closing = CLOSING_LINES[Math.floor(Math.random() * CLOSING_LINES.length)];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-200 ${visible ? 'backdrop-blur-md bg-black/60' : 'bg-transparent'}`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-bg-secondary rounded-2xl p-6 mx-4 max-w-md w-full max-h-[80vh] overflow-y-auto transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-bg-tertiary transition-colors text-text-dim"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <h2 className="font-display text-xl font-bold text-text-primary mb-6 opacity-0 animate-slide-up">
          포트폴리오 로스트 🔥
        </h2>

        {/* Roast lines */}
        <div className="space-y-3">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-sm text-text-secondary font-display opacity-0 animate-slide-up"
              style={{ animationDelay: `${(i + 1) * 150}ms` }}
            >
              {line}
            </p>
          ))}

          {/* Closing advice */}
          <p
            className="text-sm text-text-dim font-display italic border-t border-bg-tertiary pt-3 mt-4 opacity-0 animate-slide-up"
            style={{ animationDelay: `${(lines.length + 1) * 150}ms` }}
          >
            {closing}
          </p>
        </div>
      </div>
    </div>
  );
}
