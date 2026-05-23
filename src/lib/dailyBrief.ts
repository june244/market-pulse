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
  leaders: { symbol: string; amount: number; changePercent: number }[];
  laggards: { symbol: string; amount: number; changePercent: number }[];
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

const SYSTEM_PROMPT = `당신은 한국어로 작성하는 시장 브리핑 작성자입니다.
입력으로 시장 지표와 종목 데이터를 받아 사용자에게 보여줄 2~3문장 짜리 데일리 브리핑을 만듭니다.

규칙:
- 반드시 한국어, 2~3문장, 총 200자 이내.
- 톤은 시니어 트레이더가 친구에게 짧게 정리해주는 느낌. 정보 밀도 높고 군더더기 없음.
- 핵심만: Fear&Greed/VIX 분위기 + 매크로 흐름 한 줄, 그리고 포트폴리오 일일 손익을 움직인 종목 1~2개.
- 포트폴리오 데이터가 있으면 총 일일 P/L(%와 금액), 가장 크게 기여한 종목/발목 잡은 종목을 우선 언급.
- 다가오는 earnings/dividend가 있으면 D-N 형태로 짚을 것 (예: NVDA 어닝 D-3).
- 분석가 mean이 매우 강한 매수(1.0~1.5) 또는 매도(4.0+) 신호이거나 Reddit 멘션이 큰 종목은 언급.
- 숫자는 반올림. 불필요한 인사말("안녕하세요" 등), 면책 문구, 마크다운, 이모지, 따옴표 사용 금지.
- 출력은 본문만. 라벨이나 헤더 없이 문장으로 시작.`;

function summarizeInput(input: BriefInput): string {
  const lines: string[] = [];
  lines.push(`날짜: ${input.date}`);

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
