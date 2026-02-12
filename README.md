# Market Pulse — 시장 심리 대시보드 PWA

Fear & Greed Index, VIX, 관심 종목 종가를 한 화면에서 추적하는 PWA 대시보드.

## 스크린샷 구성

```
┌──────────────────────────────────────────────┐
│  ● Market Pulse                    [갱신][편집] │
├──────────────────┬───────────────────────────┤
│  Fear & Greed    │  CBOE VIX                 │
│  ┌────────┐      │  17.68 ▲0.32              │
│  │  게이지  │      │  ████████░░░░  (보통)      │
│  │   36    │      │                           │
│  │  공포   │      │  불안감 상승. 헤지 수요      │
│  └────────┘      │  증가 구간.                 │
│  전일 41 | 1주 38 │                           │
├──────────────────┴───────────────────────────┤
│  Watchlist                            LIVE    │
│  NVDA   $138.25   +2.34   +1.72%    128.2M   │
│  IREN   $12.45    -0.32   -2.51%    5.4M     │
│  MSFT   $412.80   +1.15   +0.28%    22.1M    │
│  ...                                          │
└──────────────────────────────────────────────┘
```

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **스타일링**: Tailwind CSS
- **데이터 소스** (무료):
  - CNN Fear & Greed Index (비공식 API)
  - Yahoo Finance (비공식 quote API)
- **배포**: Vercel
- **PWA**: Service Worker + Web App Manifest

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버

```bash
npm run dev
```

http://localhost:3000 에서 확인

### 3. 빌드

```bash
npm run build
```

## Vercel 배포

### 방법 1: Vercel CLI

```bash
npm i -g vercel
vercel
```

### 방법 2: GitHub 연동

1. 이 프로젝트를 GitHub에 push
2. [vercel.com](https://vercel.com)에서 "Import Project"
3. GitHub 저장소 선택
4. 자동 배포 완료

### 환경 변수

현재는 무료 API만 사용하므로 환경 변수 불필요.
추후 유료 API 전환 시:

```env
ALPHA_VANTAGE_KEY=your_key
FINNHUB_KEY=your_key
```

## PWA 설치

### iOS
1. Safari에서 사이트 접속
2. 공유 버튼 → "홈 화면에 추가"

### Android
1. Chrome에서 사이트 접속
2. "홈 화면에 추가" 배너 클릭

### Desktop
1. Chrome 주소 표시줄의 설치 아이콘 클릭

## 커스터마이징

### 기본 워치리스트 변경

`src/lib/utils.ts`에서 `DEFAULT_TICKERS` 배열 수정:

```ts
const DEFAULT_TICKERS = ['NVDA', 'IREN', 'MSFT', 'AAPL', 'GOOGL', 'META', 'AMZN', 'TSLA'];
```

### 갱신 주기 변경

`src/app/page.tsx`에서 `REFRESH_INTERVAL` 수정:

```ts
const REFRESH_INTERVAL = 60_000; // 밀리초 단위
```

### PWA 아이콘

`/public/icon-192.png`과 `/public/icon-512.png`을 원하는 아이콘으로 교체.

## 데이터 소스 주의사항

⚠️ **비공식 API 사용 중**

- Yahoo Finance와 CNN의 비공식 엔드포인트를 사용합니다
- 언제든 중단/변경될 수 있습니다
- 상업적 사용 시 공식 API 라이센스 확인 필요
- 투자 판단의 근거로 사용하지 마세요

### 유료 API 전환 옵션

안정성이 필요하면:
- **Alpha Vantage** ($49.99/mo): 주가 + VIX
- **Finnhub** (무료 60 req/min, 유료 옵션): 실시간 주가
- **Polygon.io** ($29/mo): 종합 데이터

## 파일 구조

```
market-pulse/
├── public/
│   ├── manifest.json        # PWA 매니페스트
│   └── sw.js                # Service Worker
├── src/
│   ├── app/
│   │   ├── api/market/
│   │   │   └── route.ts     # API 프록시 (CORS 우회)
│   │   ├── globals.css      # 전역 스타일
│   │   ├── layout.tsx       # 루트 레이아웃
│   │   └── page.tsx         # 메인 대시보드
│   ├── components/
│   │   ├── FearGreedGauge.tsx
│   │   ├── VIXCard.tsx
│   │   ├── TickerTable.tsx
│   │   └── TickerEditor.tsx
│   └── lib/
│       ├── types.ts
│       └── utils.ts
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 라이센스

MIT
# market-pulse
