import type { CategoryType, Match, Pool, Team, Tournament } from '@/types';
import { computePoolStandings, isTeamCategory } from '@/lib/poolStandings';
import { isRubberMatch } from '@/lib/teamMatchRubbers';

export type NameLookupEntry = { id: string; name: string };

export const KNOCKOUT_ROUNDS = ['QF', 'SF', 'F', 'TP'] as const;
export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];

export const KNOCKOUT_ROUND_LABELS: Record<KnockoutRound, string> = {
  QF: 'Quarter Final',
  SF: 'Semi Final',
  F: 'Final',
  TP: 'Third Place',
};

export function isKnockoutRound(round: string): round is KnockoutRound {
  return (KNOCKOUT_ROUNDS as readonly string[]).includes(round);
}

export interface BracketSlotMember {
  id: string;
  name: string;
  slotLabel: string;
  isResolved: boolean;
}

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
    registrations?: NameLookupEntry[];
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

function winnerMatchesPlayer(winner: string, name: string | undefined, partnerName?: string | null): boolean {
  if (!name) return false;
  const w = winner.trim().toLowerCase();
  const n = name.trim().toLowerCase();
  if (w === n || n.includes(w) || w.includes(n)) return true;
  if (partnerName) {
    const pn = partnerName.trim().toLowerCase();
    if (w === pn || pn.includes(w) || w.includes(pn)) return true;
  }
  return false;
}

export function getMatchWinner(m: Match): KnockoutParticipant | null {
  if (m.status !== 'completed') return null;
  if (m.winner) {
    if (winnerMatchesPlayer(m.winner, m.player1Name, m.player1PartnerName)) return { id: m.player1Id, name: m.player1Name };
    if (winnerMatchesPlayer(m.winner, m.player2Name, m.player2PartnerName)) return { id: m.player2Id, name: m.player2Name };
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

/** Parse "Winner of QF1", "tbd-winner-QF1", "W. QF1", etc. into a source match number token. */
export function extractBracketSrcMatchNo(str: string): string | null {
  const m1 = str.match(/(?:Winner|Loser)\s+of\s+(.+)/i) || str.match(/^[WL]\.\s+(.+)/i);
  if (m1) return m1[1].trim();
  const m2 = str.match(/^tbd-(?:winner|loser)-(.+)/i);
  if (m2) return m2[1];
  return null;
}

/** Match bracket refs like "QF1" or "Qualifier2" to stored match numbers / rounds. */
export function bracketMatchNumbersMatch(ref: string, match: Match): boolean {
  const normalized = ref.trim();
  const mn = String(match.matchNumber);
  if (mn === normalized) return true;
  const round = match.round;
  if (round) {
    // Ref is the round name itself (e.g. "Qualifier2" for an IPL playoff round)
    if (normalized.toLowerCase() === round.toLowerCase()) return true;
    if (mn === `${round}${normalized}`) return true;
    if (normalized === `${round}${mn}`) return true;
  }
  return false;
}

export function findBracketSourceMatch(sourceMatches: Match[], srcNo: string): Match | undefined {
  return sourceMatches.find(m => bracketMatchNumbersMatch(srcNo, m));
}

function sideMatchesQf(sideId: string, sideName: string, qf: Match): boolean {
  if (sideId && (sideId === qf.player1Id || sideId === qf.player2Id)) return true;
  if (sideName && (sideName === qf.player1Name || sideName === qf.player2Name)) return true;
  const winner = getMatchWinner(qf);
  if (!winner) return false;
  if (sideId && winner.id === sideId) return true;
  if (sideName && winner.name === sideName) return true;
  if (sideName && winner.name.toLowerCase() === sideName.toLowerCase()) return true;
  return false;
}

/** Map an SF slot (placeholder or resolved winner) back to its source QF index. */
export function findQfIndexForBracketSide(
  playerId: string,
  playerName: string,
  qfMatches: Match[],
): number {
  const srcNo = extractBracketSrcMatchNo(playerName) || extractBracketSrcMatchNo(playerId);
  if (srcNo) {
    const idx = qfMatches.findIndex(m => bracketMatchNumbersMatch(srcNo, m));
    if (idx >= 0) return idx;
  }
  return qfMatches.findIndex(qf => sideMatchesQf(playerId, playerName, qf));
}

/** Order QF indices so each SF's two feeder QF matches are adjacent (e.g. M1,M4,M2,M3). */
export function orderQfIndicesForSfBracket(qfMatches: Match[], sfMatches: Match[]): number[] {
  if (sfMatches.length === 0 || qfMatches.length < 2) {
    return qfMatches.map((_, i) => i);
  }

  const newOrder: number[] = [];
  const used = new Set<number>();

  for (const sf of sfMatches) {
    for (const [id, name] of [[sf.player1Id, sf.player1Name], [sf.player2Id, sf.player2Name]] as const) {
      const idx = findQfIndexForBracketSide(id, name, qfMatches);
      if (idx >= 0 && !used.has(idx)) {
        newOrder.push(idx);
        used.add(idx);
      }
    }
  }

  for (let i = 0; i < qfMatches.length; i++) {
    if (!used.has(i)) newOrder.push(i);
  }

  return newOrder.length === qfMatches.length ? newOrder : qfMatches.map((_, i) => i);
}

export function bracketReferencesSourceMatch(ref: string, sourceMatch: Match): boolean {
  const srcNo = extractBracketSrcMatchNo(ref);
  if (!srcNo) return false;
  return bracketMatchNumbersMatch(srcNo, sourceMatch);
}

export function isKnockoutBracketPlaceholder(playerId: string, playerName: string): boolean {
  if (playerId.startsWith('tbd-')) return true;
  if (/^(Winner|Loser)\s+of\s+/i.test(playerName)) return true;
  return extractBracketSrcMatchNo(playerId) != null;
}

function isLoserBracketSlot(playerId: string, playerName: string): boolean {
  return /loser/i.test(playerId) || /^Loser\s+of/i.test(playerName);
}

export function filterKnockoutMatchesForCategory(
  matches: Match[],
  round: string,
  category: CategoryType,
): Match[] {
  return matches.filter(m => {
    if (m.round !== round || isRubberMatch(m)) return false;
    if (m.category === category) return true;
    if (m.category) return false;
    const inRound = matches.filter(x => x.round === round && !isRubberMatch(x));
    const categorized = inRound.filter(x => x.category);
    if (categorized.length === 0) return true;
    return categorized.every(x => x.category === category);
  });
}

export type KnockoutPropagationUpdate = {
  matchId: string;
  player1Id?: string;
  player1Name?: string;
  player2Id?: string;
  player2Name?: string;
};

/** When a knockout match completes, fill downstream SF/F/TP slots that reference it. */
export function getKnockoutPropagationUpdates(
  completedMatch: Match,
  allMatches: Match[],
): KnockoutPropagationUpdate[] {
  if (completedMatch.status !== 'completed' || !isKnockoutRound(completedMatch.round)) return [];

  const winner = getMatchWinner(completedMatch);
  const loser = getMatchLoser(completedMatch);
  if (!winner) return [];

  const category = completedMatch.category;
  const updates: KnockoutPropagationUpdate[] = [];

  for (const m of allMatches) {
    if (!isKnockoutRound(m.round) || m.id === completedMatch.id || isRubberMatch(m)) continue;
    if (category && m.category && m.category !== category) continue;

    const patch: KnockoutPropagationUpdate = { matchId: m.id };
    const sides: [string, string, 'player1Id' | 'player2Id', 'player1Name' | 'player2Name'][] = [
      [m.player1Id, m.player1Name, 'player1Id', 'player1Name'],
      [m.player2Id, m.player2Name, 'player2Id', 'player2Name'],
    ];

    for (const [id, name, idKey, nameKey] of sides) {
      if (!bracketReferencesSourceMatch(name, completedMatch) && !bracketReferencesSourceMatch(id, completedMatch)) {
        continue;
      }
      const participant = isLoserBracketSlot(id, name) ? loser : winner;
      if (!participant) continue;
      patch[idKey] = participant.id;
      patch[nameKey] = participant.name;
    }

    if (patch.player1Id || patch.player2Id) updates.push(patch);
  }

  return updates;
}

const KNOCKOUT_PREV_ROUND: Partial<Record<KnockoutRound, KnockoutRound>> = {
  SF: 'QF',
  F: 'SF',
  TP: 'SF',
};

/** Resolve a placeholder side (e.g. "Winner of QF1") to the actual participant name. */
export function resolveKnockoutBracketSide(
  playerId: string,
  playerName: string,
  match: Match,
  allMatches: Match[],
): string | null {
  if (!isKnockoutRound(match.round) || match.round === 'QF') return null;
  if (!isKnockoutBracketPlaceholder(playerId, playerName)) return null;

  const prevRound = KNOCKOUT_PREV_ROUND[match.round];
  if (!prevRound || !match.category) return null;

  const srcNo = extractBracketSrcMatchNo(playerName) || extractBracketSrcMatchNo(playerId);
  if (!srcNo) return null;

  const sourceMatches = filterKnockoutMatchesForCategory(allMatches, prevRound, match.category);
  const srcMatch = findBracketSourceMatch(sourceMatches, srcNo);
  if (srcMatch?.status !== 'completed') return null;

  const participant = isLoserBracketSlot(playerId, playerName)
    ? getMatchLoser(srcMatch)
    : getMatchWinner(srcMatch);
  return participant?.name ?? null;
}

/** Bracket slot options for SF/F/TP — winners (or losers for TP) from the prior round. */
export function getKnockoutSlotMembers(
  targetRound: KnockoutRound,
  category: CategoryType,
  matches: Match[],
): BracketSlotMember[] | null {
  const prevRound = KNOCKOUT_PREV_ROUND[targetRound];
  if (!prevRound) return null;

  const prevMatches = filterKnockoutMatchesForCategory(matches, prevRound, category)
    .sort((a, b) => String(a.matchNumber).localeCompare(String(b.matchNumber), undefined, { numeric: true }));

  if (prevMatches.length === 0) return null;

  const isLoserRound = targetRound === 'TP';
  const labelPrefix = isLoserRound ? 'Loser' : 'Winner';

  return prevMatches.map(m => {
    const participant = isLoserRound ? getMatchLoser(m) : getMatchWinner(m);
    const slotLabel = `${labelPrefix} of ${m.matchNumber}`;
    if (participant) {
      return { id: participant.id, name: participant.name, slotLabel, isResolved: true };
    }
    return {
      id: `tbd-${labelPrefix.toLowerCase()}-${m.matchNumber}`,
      name: slotLabel,
      slotLabel,
      isResolved: false,
    };
  });
}

export function bracketSlotDisplayLabel(slot: BracketSlotMember): string {
  if (slot.slotLabel && slot.isResolved) return `${slot.slotLabel} — ${slot.name}`;
  return slot.slotLabel || slot.name;
}

export function getRoundParticipants(
  matches: Match[],
  round: KnockoutRound,
  category: CategoryType,
  mode: 'winners' | 'losers',
): KnockoutParticipant[] {
  return filterKnockoutMatchesForCategory(matches, round, category)
    .sort((a, b) => String(a.matchNumber).localeCompare(String(b.matchNumber), undefined, { numeric: true }))
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
    registrations: NameLookupEntry[];
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

  const sourceMatches = filterKnockoutMatchesForCategory(matches, source, category);
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
