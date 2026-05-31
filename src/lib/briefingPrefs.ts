/**
 * Briefing preferences — user's investment philosophy + per-ticker narrative mapping.
 * Used to personalize the Daily Brief so it reflects how the user actually thinks
 * about each holding (long-term execution, narrative reinforcement, NAVS+FES lens).
 */

import { storeGet, storeSet } from './persistentStore';

export type NarrativeTag = 'AI' | 'SPACE' | 'COIN' | '양자' | '반도체' | '에너지' | '기타';

export const NARRATIVE_OPTIONS: NarrativeTag[] = [
  'AI',
  'SPACE',
  'COIN',
  '양자',
  '반도체',
  '에너지',
  '기타',
];

export interface TickerNarrative {
  narrative: NarrativeTag;
  thesis?: string;        // 1줄: 강세/약세 핵심 테제
  monitoring?: string;    // 1줄: 이번 분기 검증 포인트
}

export interface BriefingPrefs {
  /**
   * Free-form Korean text describing the user's investment philosophy.
   * Injected into the SYSTEM_PROMPT (as supplementary context) so Claude
   * frames the brief through the user's lens.
   */
  philosophy: string;
  /** Per-ticker narrative + thesis mapping. Keyed by uppercase symbol. */
  narratives: Record<string, TickerNarrative>;
  updatedAt?: string;
}

const STORE_KEY = 'briefingPrefs:v1';

const DEFAULT_PHILOSOPHY = `장기 관점에서 회사의 미래 실행력과 내러티브 정합성으로 판단한다. 단기 가격 변동, 집중도/변동성 같은 단편적 정량 리스크는 노이즈로 본다.

판단 프레임: NAVS v1.5 = (메가 내러티브 강도 40%) + (병목/대체불가능성 25%) + (수직계열화 15%) + (재무 건전성 10%) + (CEO 리더십 5%) + (모멘텀 5%), 그리고 별도 차원의 FES = (로드맵 명확성) + (마일스톤 달성 시 가치) + (실행력 트랙레코드).

핵심 질문: "이 회사가 약속을 지키고 있는가? 내러티브 테제가 강화되고 있는가, 훼손되고 있는가?"`;

const DEFAULT_NARRATIVES: Record<string, TickerNarrative> = {
  IREN: { narrative: 'AI', thesis: 'AI 인프라 자금 폭주처. NVIDIA 5GW 파트너십 + Sweetwater 1/2 실행이 핵심.' },
  INTC: { narrative: 'AI', thesis: '18A 외부 파운드리 고객 확보 시 대반전. 단 실행력 트랙레코드가 발목.' },
  RKLB: { narrative: 'SPACE', thesis: 'Neutron 발사 성공 + 정부 백로그 실현이 테제. 단 일정 지연 이력 리스크.' },
  CRCL: { narrative: 'COIN', thesis: 'USDC 점유율 + Arc 출시. 단 금리 의존 수익 구조가 천장.' },
  INFQ: { narrative: '양자', thesis: '100 logical qubit by 2028 로드맵. 도입기 산업, FES 부족.' },
};

export async function getBriefingPrefs(): Promise<BriefingPrefs> {
  const stored = await storeGet<BriefingPrefs>(STORE_KEY);
  if (stored && (stored.philosophy || Object.keys(stored.narratives ?? {}).length > 0)) {
    return {
      philosophy: stored.philosophy ?? DEFAULT_PHILOSOPHY,
      narratives: stored.narratives ?? {},
      updatedAt: stored.updatedAt,
    };
  }
  // First-run: seed with defaults
  return {
    philosophy: DEFAULT_PHILOSOPHY,
    narratives: { ...DEFAULT_NARRATIVES },
  };
}

export async function setBriefingPrefs(prefs: BriefingPrefs): Promise<void> {
  const normalized: BriefingPrefs = {
    philosophy: prefs.philosophy ?? '',
    narratives: Object.fromEntries(
      Object.entries(prefs.narratives ?? {}).map(([sym, n]) => [
        sym.toUpperCase(),
        {
          narrative: n.narrative,
          thesis: n.thesis?.trim() || undefined,
          monitoring: n.monitoring?.trim() || undefined,
        },
      ]),
    ),
    updatedAt: new Date().toISOString(),
  };
  await storeSet(STORE_KEY, normalized);
}

export { DEFAULT_PHILOSOPHY, DEFAULT_NARRATIVES };
