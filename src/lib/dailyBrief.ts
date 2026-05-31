/**
 * Daily Brief generation via Anthropic Claude Haiku.
 *
 * - Cron generates the brief once per day → in-memory cache keyed by date.
 * - User requests return the cached brief immediately, regenerate on miss.
 */

import Anthropic from '@anthropic-ai/sdk';
import { storeGet, storeSet } from './persistentStore';

export interface BriefTickerSnapshot {
  symbol: string;
  changePercent: number;
  weight?: number;
  analystMean?: number | null;
  redditMentions?: number | null;
}

export interface BriefEvent {
  symbol: string;
  type: 'earnings' | 'exDividend' | 'dividend';
  daysUntil: number;
}

export interface BriefPortfolioSnapshot {
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  risk: {
    score: number;
    label: string;
    topHolding: { symbol: string; weight: number } | null;
    topThreeWeight: number;
    effectivePositions: number;
    highVolWeight: number;
    highVolSymbols: string[];
  } | null;
  leaders: { symbol: string; amount: number; changePercent: number }[];
  laggards: { symbol: string; amount: number; changePercent: number }[];
}

export interface BriefTickerNarrative {
  symbol: string;
  narrative: string;
  thesis?: string;
  monitoring?: string;
}

export interface BriefInput {
  date: string;
  cacheKey?: string;
  fearGreed: { score: number; rating: string } | null;
  vix: { value: number; changePercent: number } | null;
  macro: { label: string; changePercent: number }[];
  tickers: BriefTickerSnapshot[];
  upcomingEvents: BriefEvent[];
  portfolio: BriefPortfolioSnapshot | null;
  /** User's investment philosophy — injected into the system prompt. */
  philosophy?: string;
  /** Per-ticker narrative + thesis mapping for holdings the user cares about. */
  tickerNarratives?: BriefTickerNarrative[];
}

export interface BriefOutput {
  text: string;
  generatedAt: string;
  date: string;
  cached: boolean;
}

const cache = new Map<string, BriefOutput>();
const KEY_PREFIX = 'dailyBrief';

export async function getBriefCached(dateKey: string): Promise<BriefOutput | null> {
  const memory = cache.get(dateKey);
  if (memory) return memory;
  const persisted = await storeGet<BriefOutput>(`${KEY_PREFIX}:${dateKey}`);
  if (persisted) cache.set(dateKey, persisted);
  return persisted;
}

export async function setBriefCached(dateKey: string, brief: BriefOutput): Promise<void> {
  cache.set(dateKey, brief);
  await storeSet(`${KEY_PREFIX}:${dateKey}`, brief);
}

const SYSTEM_PROMPT = `당신은 한국어로 작성하는 시장 브리핑 작성자다. 사용자의 투자 철학을 받아 그 렌즈로 해석한 2~4문장 데일리 브리핑을 만든다.

## 사용자 투자 철학 (반드시 이 관점으로 해석)

장기 관점에서 회사의 미래 실행력과 내러티브 정합성이 핵심이다. 단기 가격 변동, 집중도/변동성/포트 수익률 같은 단편적 정량 리스크는 이 사용자에게 노이즈다 — 그런 얘기는 하지 마라.

판단 프레임은 NAVS v1.5 + FES 두 차원:
- **NAVS** = (메가 내러티브 강도 40%) + (병목/대체불가능성 25%) + (수직계열화 15%) + (재무 건전성 10%) + (CEO 리더십 5%) + (모멘텀 5%)
- **FES (Forward Execution Score)** = (로드맵 명확성) + (마일스톤 달성 시 가치) + (실행력 트랙레코드)

핵심 질문은 항상: **"이 회사가 약속을 지키고 있는가? 내러티브 테제가 강화되고 있는가, 훼손되고 있는가?"**

## 작성 규칙

- 한국어, 2~4문장, 총 280자 이내.
- 매일 변하는 가격·일일 P/L·집중도 점수를 메인으로 깔지 말 것. 사용자는 이미 본다.
- 대신 다음을 우선 다룬다:
  1. **내러티브별 클러스터링**: 보유 종목을 사용자가 부여한 내러티브(AI/SPACE/COIN/양자 등)로 묶어 해당 테마의 흐름과 연결.
  2. **실행 시그널**: 어닝, 마일스톤, 가이던스 변화, 경영진 발언, 분석가 등급 변경 — 이것이 *테제를 강화/훼손* 하는지 평가.
  3. **모니터링 포인트 트리거**: 사용자가 적어둔 monitoring 항목과 오늘의 데이터가 맞닿으면 명시.
  4. **다가오는 이벤트**: 어닝/배당 D-N — 이게 테제 검증의 분기점인지 짚을 것.
- 매크로(F&G, VIX, 금리, 달러)는 *내러티브에 미치는 영향* 관점에서만 1줄. 단순 수치 나열 금지.
- 분석가 mean이 강한 매수(1.0~1.5) 또는 매도(4.0+)면 "테제 강화/약화 시그널" 맥락으로 언급.
- 출력은 본문만. 인사말, 면책, 마크다운, 이모지, 따옴표, 헤더 라벨 모두 금지. 평서문으로 시작.
- 데이터가 비어있으면 무리하게 채우지 말고 알고 있는 것만 다룬다.`;

function summarizeInput(input: BriefInput): string {
  const lines: string[] = [];
  lines.push(`날짜: ${input.date}`);

  if (input.philosophy && input.philosophy.trim()) {
    lines.push('');
    lines.push('## 사용자 추가 메모 (철학 보완)');
    lines.push(input.philosophy.trim());
    lines.push('');
  }

  if (input.tickerNarratives && input.tickerNarratives.length > 0) {
    lines.push('## 종목별 내러티브 & 테제');
    for (const n of input.tickerNarratives) {
      const parts: string[] = [n.narrative];
      if (n.thesis) parts.push(`테제: ${n.thesis}`);
      if (n.monitoring) parts.push(`모니터링: ${n.monitoring}`);
      lines.push(`  ${n.symbol} — ${parts.join(' / ')}`);
    }
    lines.push('');
  }

  if (input.fearGreed) {
    lines.push(`Fear&Greed: ${input.fearGreed.score} (${input.fearGreed.rating})`);
  }
  if (input.vix) {
    const dir = input.vix.changePercent >= 0 ? '+' : '';
    lines.push(`VIX: ${input.vix.value.toFixed(1)} (${dir}${input.vix.changePercent.toFixed(1)}%)`);
  }
  if (input.macro.length > 0) {
    const macroLine = input.macro
      .map((m) => `${m.label} ${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}%`)
      .join(', ');
    lines.push(`매크로: ${macroLine}`);
  }

  if (input.tickers.length > 0) {
    lines.push('등록 종목:');
    for (const t of input.tickers) {
      const parts: string[] = [];
      parts.push(`${t.changePercent >= 0 ? '+' : ''}${t.changePercent.toFixed(2)}%`);
      if (t.analystMean != null) parts.push(`mean ${t.analystMean.toFixed(2)}`);
      if (t.redditMentions != null && t.redditMentions > 0) parts.push(`reddit ${t.redditMentions}`);
      lines.push(`  ${t.symbol}: ${parts.join(', ')}`);
    }
  }

  if (input.portfolio) {
    const p = input.portfolio;
    const dir = p.dailyChange >= 0 ? '+' : '';
    lines.push(`포트폴리오: 총액 $${Math.round(p.totalValue).toLocaleString('en-US')}, 오늘 ${dir}$${Math.abs(p.dailyChange).toFixed(0)} (${dir}${p.dailyChangePercent.toFixed(2)}%)`);
    if (p.leaders.length > 0) {
      lines.push(`기여: ${p.leaders.map((x) => `${x.symbol} ${x.amount >= 0 ? '+' : ''}$${x.amount.toFixed(0)} (${x.changePercent >= 0 ? '+' : ''}${x.changePercent.toFixed(1)}%)`).join(', ')}`);
    }
    if (p.laggards.length > 0) {
      lines.push(`차감: ${p.laggards.map((x) => `${x.symbol} ${x.amount >= 0 ? '+' : ''}$${x.amount.toFixed(0)} (${x.changePercent >= 0 ? '+' : ''}${x.changePercent.toFixed(1)}%)`).join(', ')}`);
    }
    if (p.risk) {
      const top = p.risk.topHolding
        ? `TOP1 ${p.risk.topHolding.symbol} ${p.risk.topHolding.weight.toFixed(0)}%`
        : 'TOP1 없음';
      const highVol = p.risk.highVolSymbols.length > 0
        ? `HIGH VOL ${p.risk.highVolWeight.toFixed(0)}% (${p.risk.highVolSymbols.slice(0, 2).join('/')})`
        : `HIGH VOL ${p.risk.highVolWeight.toFixed(0)}%`;
      lines.push(`리스크: ${p.risk.label} ${p.risk.score}, ${top}, TOP3 ${p.risk.topThreeWeight.toFixed(0)}%, 유효종목 ${p.risk.effectivePositions.toFixed(1)}, ${highVol}`);
    }
  }

  if (input.upcomingEvents.length > 0) {
    lines.push('다가오는 이벤트(3일 내):');
    for (const e of input.upcomingEvents) {
      const tag = e.type === 'earnings' ? '어닝' : e.type === 'exDividend' ? '배당락' : '배당지급';
      lines.push(`  ${e.symbol} ${tag} D-${e.daysUntil}`);
    }
  }

  return lines.join('\n');
}

export async function generateBrief(input: BriefInput): Promise<BriefOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey });
  const userContent = summarizeInput(input);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      { role: 'user', content: userContent },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const brief: BriefOutput = {
    text,
    generatedAt: new Date().toISOString(),
    date: input.date,
    cached: false,
  };
  await setBriefCached(input.cacheKey ?? input.date, brief);
  return brief;
}
