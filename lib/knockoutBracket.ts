import type { CategoryType, Match, Pool, Tournament } from '@/types';
import { computePoolStandings, isTeamCategory } from '@/lib/poolStandings';
import type { Team } from '@/types';
import type { Registration } from '@/types';

export const KNOCKOUT_ROUNDS = ['QF', 'SF', 'F', 'TP'] as const;
export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];

export const KNOCKOUT_ROUND_LABELS: Record<KnockoutRound, string> = {
  QF: 'Quarter Final',
  SF: 'Semi Final',
  F: 'Final',
  TP: 'Third Place',
};

export interface KnockoutParticipant {
  id: string;
  name: string;
  poolName?: string;
  poolRank?: number;
}

export interface KnockoutPairing {
  player1: KnockoutParticipant;
  player2: KnockoutParticipant;
  matchNumber: number;
}

export interface KnockoutPreview {
  pairings: KnockoutPairing[];
  warnings: string[];
  qualifiedCount: number;
}

const DEFAULT_QUALIFY_COUNT = 2;

export function getQualifyCount(
  pool: Pool,
  categoryQualifyCounts?: Partial<Record<CategoryType, number>>,
): number {
  if (pool.qualifyCount != null && pool.qualifyCount > 0) return pool.qualifyCount;
  if (categoryQualifyCounts?.[pool.category] != null && categoryQualifyCounts[pool.category]! > 0) {
    return categoryQualifyCounts[pool.category]!;
  }
  return DEFAULT_QUALIFY_COUNT;
}

export function getCategoryQualifyCount(
  category: CategoryType,
  categoryQualifyCounts?: Partial<Record<CategoryType, number>>,
): number {
  const n = categoryQualifyCounts?.[category];
  return n != null && n > 0 ? n : DEFAULT_QUALIFY_COUNT;
}

export function sortPoolsForBracket(pools: Pool[]): Pool[] {
  return [...pools].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

export function getQualifiedByPool(
  pools: Pool[],
  matches: Match[],
  options: {
    isTeamCat: boolean;
    teams?: Team[];
    registrations?: Registration[];
    categoryQualifyCounts?: Partial<Record<CategoryType, number>>;
  },
): { pool: Pool; qualified: KnockoutParticipant[] }[] {
  const sorted = sortPoolsForBracket(pools);
  const nameLookup = (id: string) => {
    if (options.isTeamCat) {
      return options.teams?.find(t => t.id === id)?.name ?? id;
    }
    return options.registrations?.find(r => r.id === id)?.name ?? id;
  };

  return sorted.map(pool => {
    const qualifyCount = getQualifyCount(pool, options.categoryQualifyCounts);
    const standings = computePoolStandings(pool, matches, {
      isTeamCat: options.isTeamCat,
      teams: options.teams,
      nameLookup,
    });
    const qualified = standings.slice(0, qualifyCount).map((row, idx) => ({
      id: row.id,
      name: row.name,
      poolName: pool.name,
      poolRank: idx + 1,
    }));
    return { pool, qualified };
  });
}

/** Cross-pool QF: pool[i] 1st vs pool[(i+1) % n] 2nd */
export function buildCrossPoolQFPairings(
  qualifiedByPool: KnockoutParticipant[][],
): KnockoutPairing[] {
  const n = qualifiedByPool.length;
  if (n < 2) return [];

  const pairings: KnockoutPairing[] = [];
  for (let i = 0; i < n; i++) {
    const first = qualifiedByPool[i]?.[0];
    const second = qualifiedByPool[(i + 1) % n]?.[1];
    if (first && second) {
      pairings.push({
        player1: first,
        player2: second,
        matchNumber: pairings.length + 1,
      });
    }
  }
  return pairings;
}

export function buildSeededBracketPairings(participants: KnockoutParticipant[]): KnockoutPairing[] {
  const pairings: KnockoutPairing[] = [];
  const n = participants.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const player1 = participants[i];
    const player2 = participants[n - 1 - i];
    if (player1 && player2) {
      pairings.push({ player1, player2, matchNumber: pairings.length + 1 });
    }
  }
  return pairings;
}

export function buildQFPairings(
  qualifiedByPool: KnockoutParticipant[][],
  qualifyCount: number,
): KnockoutPairing[] {
  if (qualifyCount === 2 && qualifiedByPool.length >= 2) {
    const allHaveTwo = qualifiedByPool.every(q => q.length >= 2);
    if (allHaveTwo) return buildCrossPoolQFPairings(qualifiedByPool);
  }

  const seeded: KnockoutParticipant[] = [];
  const n = qualifiedByPool.length;
  for (let rank = 0; rank < qualifyCount; rank++) {
    for (let i = 0; i < n; i++) {
      const p = qualifiedByPool[i]?.[rank];
      if (p) seeded.push(p);
    }
  }
  return buildSeededBracketPairings(seeded);
}

export function getMatchWinner(m: Match): KnockoutParticipant | null {
  if (m.status !== 'completed') return null;
  if (m.winner) {
    if (m.winner === m.player1Name) return { id: m.player1Id, name: m.player1Name };
    if (m.winner === m.player2Name) return { id: m.player2Id, name: m.player2Name };
  }
  const p1 = m.player1Score ?? 0;
  const p2 = m.player2Score ?? 0;
  if (p1 > p2) return { id: m.player1Id, name: m.player1Name };
  if (p2 > p1) return { id: m.player2Id, name: m.player2Name };
  return null;
}

export function getMatchLoser(m: Match): KnockoutParticipant | null {
  if (m.status !== 'completed') return null;
  const winner = getMatchWinner(m);
  if (!winner) return null;
  if (winner.id === m.player1Id) return { id: m.player2Id, name: m.player2Name };
  return { id: m.player1Id, name: m.player1Name };
}

export function getRoundParticipants(
  matches: Match[],
  round: KnockoutRound,
  category: CategoryType,
  mode: 'winners' | 'losers',
): KnockoutParticipant[] {
  return matches
    .filter(m => m.round === round && m.category === category && !m.matchKind)
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map(m => (mode === 'winners' ? getMatchWinner(m) : getMatchLoser(m)))
    .filter((p): p is KnockoutParticipant => p != null);
}

export function buildNextRoundPairings(participants: KnockoutParticipant[]): KnockoutPairing[] {
  const pairings: KnockoutPairing[] = [];
  for (let i = 0; i < participants.length; i += 2) {
    const player1 = participants[i];
    const player2 = participants[i + 1];
    if (player1 && player2) {
      pairings.push({ player1, player2, matchNumber: pairings.length + 1 });
    }
  }
  return pairings;
}

export function previewKnockoutRound(
  round: KnockoutRound,
  category: CategoryType,
  pools: Pool[],
  matches: Match[],
  options: {
    teams: Team[];
    registrations: Registration[];
    categoryQualifyCounts?: Tournament['categoryQualifyCounts'];
  },
): KnockoutPreview {
  const warnings: string[] = [];
  const catPools = pools.filter(p => p.category === category);
  const isTeamCat = isTeamCategory(category);

  if (round === 'QF') {
    if (catPools.length < 2) {
      warnings.push('At least 2 pools are required for cross-pool knockout.');
    }
    const qualifiedData = getQualifiedByPool(catPools, matches, {
      isTeamCat,
      teams: options.teams,
      registrations: options.registrations,
      categoryQualifyCounts: options.categoryQualifyCounts,
    });
    const qualifyCount = getCategoryQualifyCount(category, options.categoryQualifyCounts);
    const byPool = qualifiedData.map(d => d.qualified);
    const shortPools = qualifiedData.filter(d => d.qualified.length < qualifyCount);
    if (shortPools.length > 0) {
      warnings.push(
        `Some pools have fewer than ${qualifyCount} qualified: ${shortPools.map(d => d.pool.name).join(', ')}. Standings may be incomplete.`,
      );
    }
    const existingQF = matches.filter(m => m.round === 'QF' && m.category === category);
    if (existingQF.length > 0) {
      warnings.push(`${existingQF.length} QF match(es) already exist for this category.`);
    }
    const pairings = buildQFPairings(byPool, qualifyCount);
    if (pairings.length === 0) {
      warnings.push('No pairings could be built. Complete pool matches and verify qualification settings.');
    }
    return {
      pairings,
      warnings,
      qualifiedCount: byPool.reduce((s, q) => s + q.length, 0),
    };
  }

  const prevRound: Record<KnockoutRound, KnockoutRound | null> = {
    QF: null,
    SF: 'QF',
    F: 'SF',
    TP: 'SF',
  };
  const source = prevRound[round];
  if (!source) {
    return { pairings: [], warnings: ['Invalid round.'], qualifiedCount: 0 };
  }

  const sourceMatches = matches.filter(
    m => m.round === source && m.category === category && !m.matchKind,
  );
  if (sourceMatches.length === 0) {
    warnings.push(`No ${KNOCKOUT_ROUND_LABELS[source]} matches found for this category. Generate ${source} first.`);
    return { pairings: [], warnings, qualifiedCount: 0 };
  }

  const incomplete = sourceMatches.filter(m => m.status !== 'completed');
  if (incomplete.length > 0) {
    warnings.push(`${incomplete.length} ${source} match(es) are not completed yet.`);
  }

  const mode = round === 'TP' ? 'losers' : 'winners';
  const participants = getRoundParticipants(matches, source, category, mode);
  if (participants.length < 2) {
    warnings.push(`Not enough ${mode} from ${source} to build ${round}.`);
  }

  const existing = matches.filter(m => m.round === round && m.category === category);
  if (existing.length > 0) {
    warnings.push(`${existing.length} ${round} match(es) already exist for this category.`);
  }

  const pairings = round === 'F'
    ? (participants.length >= 2
      ? [{ player1: participants[0], player2: participants[1], matchNumber: 1 }]
      : [])
    : buildNextRoundPairings(participants);

  return { pairings, warnings, qualifiedCount: participants.length };
}
