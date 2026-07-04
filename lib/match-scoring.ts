import type { Match, Tournament } from '@/types';
import { formatMatchSideLabel, type MatchSideNameContext } from '@/lib/utils';

type WinnerRegMap = Map<string, { name?: string; partnerName?: string | null }>;

export type MatchFormat = 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30';

export function isBestOfThree(format: MatchFormat): boolean {
  return format === 'best-of-3' || format === 'best-of-3-15pt';
}

export function resolveMatchFormat(
  match: Pick<Match, 'matchFormat'>,
  tournament?: Pick<Tournament, 'matchFormat'> | null
): MatchFormat {
  const fmt = match.matchFormat ?? tournament?.matchFormat;
  if (
    fmt === 'single-set' ||
    fmt === 'best-of-3' ||
    fmt === 'best-of-3-15pt' ||
    fmt === 'single-set-30'
  ) {
    return fmt;
  }
  return 'best-of-3';
}

export function getSetsToWin(format: MatchFormat): number {
  return format === 'single-set' || format === 'single-set-30' ? 1 : 2;
}

export function getMinSetScore(format: MatchFormat): number {
  if (format === 'single-set-30') return 30;
  if (format === 'best-of-3-15pt') return 15;
  return 21;
}

export function getMaxPointsPerSet(format: MatchFormat): number {
  return 30;
}

export function canIncrementScore(
  score: number,
  opponentScore: number,
  format: MatchFormat
): boolean {
  if (format === 'single-set-30') {
    return score < 30;
  }
  // 21pt: allow beyond 21 during deuce, soft cap at 30
  return score < 30;
}

export function isSetWon(p1: number, p2: number, format: MatchFormat): boolean {
  if (format === 'single-set-30') {
    return p1 === 30 || p2 === 30;
  }
  const minScore = getMinSetScore(format);
  const lead = 2;
  return (p1 >= minScore || p2 >= minScore) && Math.abs(p1 - p2) >= lead;
}

export function canCloseSet(p1: number, p2: number, format: MatchFormat): boolean {
  return isSetWon(p1, p2, format);
}

export function getSetWinnerName(
  p1: number,
  p2: number,
  match: MatchSideNameContext,
  regById?: WinnerRegMap,
): string {
  const side: 1 | 2 = p1 > p2 ? 1 : 2;
  return formatMatchSideLabel(match, side, regById);
}

export function getFormatLabel(format: MatchFormat): string {
  if (format === 'single-set-30') return '30pt Single set';
  if (format === 'single-set') return 'Single set (21pt)';
  if (format === 'best-of-3-15pt') return 'Best of 3 (15pt)';
  return 'Best of 3 (21pt)';
}

/** Scores shown on public match cards (set wins for best-of-3 / team ties; points for single-set individuals). */
export function getMatchCardDisplayScores(
  match: Pick<Match, 'status' | 'player1Score' | 'player2Score' | 'sets' | 'matchFormat'>,
  options: {
    tournament?: Pick<Tournament, 'matchFormat'> | null;
    isIndividualMatch?: boolean;
  } = {},
): { score1: number | string; score2: number | string } {
  const dash = '-';

  if (match.status === 'live' && match.sets?.length) {
    const last = match.sets.at(-1)!;
    return { score1: last.player1Score, score2: last.player2Score };
  }

  const format = resolveMatchFormat(match, options.tournament);
  const showPointScore = options.isIndividualMatch && !isBestOfThree(format);

  if (match.status === 'completed' && showPointScore && match.sets?.length) {
    const set = match.sets[0];
    return { score1: set.player1Score, score2: set.player2Score };
  }

  return {
    score1: match.player1Score ?? dash,
    score2: match.player2Score ?? dash,
  };
}

/** Map display-side player key back to stored player1/player2 when sides are swapped. */
export function displayPlayerToStored(
  displayPlayer: 'player1' | 'player2',
  sidesSwapped: boolean
): 'player1' | 'player2' {
  if (!sidesSwapped) return displayPlayer;
  return displayPlayer === 'player1' ? 'player2' : 'player1';
}

/** Get display order for UI when sides may be swapped. */
export function getDisplaySides(
  match: Pick<Match, 'player1Name' | 'player2Name'>,
  scores: { p1: number; p2: number; sets1: number; sets2: number },
  sidesSwapped: boolean,
  /** Side that won the last point — drives the serving indicator. */
  lastPointWonBy?: 'player1' | 'player2' | null
) {
  if (!sidesSwapped) {
    return {
      left: { name: match.player1Name, score: scores.p1, sets: scores.sets1, color: 'blue' as const, serving: lastPointWonBy === 'player1' },
      right: { name: match.player2Name, score: scores.p2, sets: scores.sets2, color: 'red' as const, serving: lastPointWonBy === 'player2' },
    };
  }
  return {
    left: { name: match.player2Name, score: scores.p2, sets: scores.sets2, color: 'red' as const, serving: lastPointWonBy === 'player2' },
    right: { name: match.player1Name, score: scores.p1, sets: scores.sets1, color: 'blue' as const, serving: lastPointWonBy === 'player1' },
  };
}
