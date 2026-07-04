import type { CategoryType, Match, Pool } from '@/types';
import type { Registration, Team } from '@/types';
import { computePoolStandings, isTeamCategory } from '@/lib/poolStandings';
import {
  getMatchLoser,
  getMatchWinner,
  type BracketSlotMember,
  type KnockoutParticipant,
  type KnockoutPairing,
  type KnockoutPreview,
} from '@/lib/knockoutBracket';
import { isRubberMatch } from '@/lib/teamMatchRubbers';

export const IPL_PLAYOFF_ROUNDS = ['Qualifier1', 'Eliminator', 'Qualifier2', 'F'] as const;
export type IplPlayoffRound = (typeof IPL_PLAYOFF_ROUNDS)[number];

/** @deprecated Legacy round codes stored on older matches */
const LEGACY_IPL_PLAYOFF_ROUND_ALIASES: Record<string, IplPlayoffRound> = {
  Q1: 'Qualifier1',
  E: 'Eliminator',
  Q2: 'Qualifier2',
};

export const IPL_PLAYOFF_ROUND_LABELS: Record<IplPlayoffRound, string> = {
  Qualifier1: 'Qualifier 1',
  Eliminator: 'Eliminator',
  Qualifier2: 'Qualifier 2',
  F: 'Final',
};

export const IPL_PLAYOFF_TOP_N = 4;

export function normalizeIplPlayoffRound(round: string): IplPlayoffRound | null {
  if ((IPL_PLAYOFF_ROUNDS as readonly string[]).includes(round)) {
    return round as IplPlayoffRound;
  }
  return LEGACY_IPL_PLAYOFF_ROUND_ALIASES[round] ?? null;
}

export function isIplPlayoffRound(round: string): round is IplPlayoffRound {
  return normalizeIplPlayoffRound(round) != null;
}

/** True for Qualifier1 / Eliminator / Qualifier2 (not Final — shared with knockout). */
export function isIplPlayoffSpecificRound(round: string): boolean {
  const normalized = normalizeIplPlayoffRound(round);
  return normalized != null && normalized !== 'F';
}

export function matchIsInIplRound(match: Pick<Match, 'round'>, round: IplPlayoffRound): boolean {
  return normalizeIplPlayoffRound(match.round) === round;
}

export function findIplRoundMatch(matches: Match[], round: IplPlayoffRound): Match | undefined {
  return matches.find(m => matchIsInIplRound(m, round));
}

export function filterIplRoundMatches(matches: Match[], round: IplPlayoffRound): Match[] {
  return matches.filter(m => matchIsInIplRound(m, round));
}

export function iplBracketSlotLabel(kind: 'winner' | 'loser', round: IplPlayoffRound): string {
  const prefix = kind === 'winner' ? 'Winner' : 'Loser';
  return `${prefix} of ${round}`;
}

export function getPoolTopFour(
  pool: Pool,
  matches: Match[],
  options: {
    isTeamCat: boolean;
    teams?: Team[];
    registrations?: Registration[];
  },
): KnockoutParticipant[] {
  const nameLookup = (id: string) => {
    if (options.isTeamCat) {
      return options.teams?.find(t => t.id === id)?.name ?? id;
    }
    return options.registrations?.find(r => r.id === id)?.name ?? id;
  };

  const standings = computePoolStandings(pool, matches, {
    isTeamCat: options.isTeamCat,
    teams: options.teams,
    nameLookup,
  });

  return standings.slice(0, IPL_PLAYOFF_TOP_N).map((row, idx) => ({
    id: row.id,
    name: row.name,
    poolName: pool.name,
    poolRank: idx + 1,
  }));
}

function singlePairing(p1: KnockoutParticipant, p2: KnockoutParticipant): KnockoutPairing[] {
  return [{ player1: p1, player2: p2, matchNumber: 1 }];
}

export function previewIplPlayoffRound(
  round: IplPlayoffRound,
  category: CategoryType,
  pool: Pool,
  matches: Match[],
  options: {
    teams: Team[];
    registrations: Registration[];
  },
): KnockoutPreview {
  const warnings: string[] = [];
  const isTeamCat = isTeamCategory(category);
  const catMatches = matches.filter(
    m => m.category === category && !isRubberMatch(m),
  );

  const topFour = getPoolTopFour(pool, matches, {
    isTeamCat,
    teams: options.teams,
    registrations: options.registrations,
  });

  if (topFour.length < IPL_PLAYOFF_TOP_N) {
    warnings.push(
      `Pool "${pool.name}" needs at least ${IPL_PLAYOFF_TOP_N} teams in standings. Currently ${topFour.length}. Complete pool matches first.`,
    );
  }

  const existingInRound = filterIplRoundMatches(catMatches, round);
  if (existingInRound.length > 0) {
    warnings.push(`${existingInRound.length} ${IPL_PLAYOFF_ROUND_LABELS[round]} match(es) already exist for this category.`);
  }

  if (round === 'Qualifier1') {
    if (topFour.length < 2) {
      return { pairings: [], warnings, qualifiedCount: topFour.length };
    }
    return {
      pairings: singlePairing(topFour[0], topFour[1]),
      warnings,
      qualifiedCount: topFour.length,
    };
  }

  if (round === 'Eliminator') {
    if (topFour.length < 4) {
      return { pairings: [], warnings, qualifiedCount: topFour.length };
    }
    return {
      pairings: singlePairing(topFour[2], topFour[3]),
      warnings,
      qualifiedCount: topFour.length,
    };
  }

  if (round === 'Qualifier2') {
    const q1 = findIplRoundMatch(catMatches, 'Qualifier1');
    const elim = findIplRoundMatch(catMatches, 'Eliminator');
    if (!q1) {
      warnings.push('Qualifier 1 match not found. Generate Qualifier1 first.');
      return { pairings: [], warnings, qualifiedCount: 0 };
    }
    if (!elim) {
      warnings.push('Eliminator match not found. Generate Eliminator first.');
      return { pairings: [], warnings, qualifiedCount: 0 };
    }
    if (q1.status !== 'completed') warnings.push('Qualifier 1 is not completed yet.');
    if (elim.status !== 'completed') warnings.push('Eliminator is not completed yet.');

    const loserQ1 = getMatchLoser(q1);
    const winnerElim = getMatchWinner(elim);
    if (!loserQ1 || !winnerElim) {
      warnings.push('Need completed Qualifier1 and Eliminator results to build Qualifier2.');
      return { pairings: [], warnings, qualifiedCount: 0 };
    }
    return {
      pairings: singlePairing(loserQ1, winnerElim),
      warnings,
      qualifiedCount: 2,
    };
  }

  // Final
  const q1 = findIplRoundMatch(catMatches, 'Qualifier1');
  const q2 = findIplRoundMatch(catMatches, 'Qualifier2');
  if (!q1) {
    warnings.push('Qualifier 1 match not found. Generate Qualifier1 first.');
    return { pairings: [], warnings, qualifiedCount: 0 };
  }
  if (!q2) {
    warnings.push('Qualifier 2 match not found. Generate Qualifier2 first.');
    return { pairings: [], warnings, qualifiedCount: 0 };
  }
  if (q1.status !== 'completed') warnings.push('Qualifier 1 is not completed yet.');
  if (q2.status !== 'completed') warnings.push('Qualifier 2 is not completed yet.');

  const winnerQ1 = getMatchWinner(q1);
  const winnerQ2 = getMatchWinner(q2);
  if (!winnerQ1 || !winnerQ2) {
    warnings.push('Need completed Qualifier1 and Qualifier2 results to build the Final.');
    return { pairings: [], warnings, qualifiedCount: 0 };
  }
  return {
    pairings: singlePairing(winnerQ1, winnerQ2),
    warnings,
    qualifiedCount: 2,
  };
}

/** Bracket slot options for Qualifier2/F — participants from prior IPL playoff rounds. */
export function getIplPlayoffSlotMembers(
  targetRound: IplPlayoffRound,
  category: CategoryType,
  matches: Match[],
): BracketSlotMember[] | null {
  const catMatches = matches.filter(m => m.category === category && !isRubberMatch(m));

  if (targetRound === 'Qualifier2') {
    const q1 = findIplRoundMatch(catMatches, 'Qualifier1');
    const elim = findIplRoundMatch(catMatches, 'Eliminator');
    if (!q1 || !elim) return null;
    const slots = [
      { match: q1, label: iplBracketSlotLabel('loser', 'Qualifier1'), isLoser: true },
      { match: elim, label: iplBracketSlotLabel('winner', 'Eliminator'), isLoser: false },
    ];
    return slots.map(({ match, label, isLoser }) => {
      const participant = isLoser ? getMatchLoser(match) : getMatchWinner(match);
      if (participant) {
        return { id: participant.id, name: participant.name, slotLabel: label, isResolved: true };
      }
      return {
        id: `tbd-${label.toLowerCase().replace(/\s+/g, '-')}`,
        name: label,
        slotLabel: label,
        isResolved: false,
      };
    });
  }

  if (targetRound === 'F') {
    const q1 = findIplRoundMatch(catMatches, 'Qualifier1');
    const q2 = findIplRoundMatch(catMatches, 'Qualifier2');
    if (!q1 || !q2) return null;
    const slots = [
      { match: q1, label: iplBracketSlotLabel('winner', 'Qualifier1'), isLoser: false },
      { match: q2, label: iplBracketSlotLabel('winner', 'Qualifier2'), isLoser: false },
    ];
    return slots.map(({ match, label, isLoser }) => {
      const participant = isLoser ? getMatchLoser(match) : getMatchWinner(match);
      if (participant) {
        return { id: participant.id, name: participant.name, slotLabel: label, isResolved: true };
      }
      return {
        id: `tbd-${label.toLowerCase().replace(/\s+/g, '-')}`,
        name: label,
        slotLabel: label,
        isResolved: false,
      };
    });
  }

  return null;
}
