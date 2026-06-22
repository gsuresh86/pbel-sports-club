import type { Match, Tournament } from '@/types';
import { formatMatchSideLabel, type MatchSideNameContext } from '@/lib/utils';

type WinnerRegMap = Map<string, { name?: string; partnerName?: string | null }>;

export type MatchFormat = 'single-set' | 'best-of-3' | 'single-set-30';

export function resolveMatchFormat(
  match: Pick<Match, 'matchFormat'>,
  tournament?: Pick<Tournament, 'matchFormat'> | null
): MatchFormat {
  const fmt = match.matchFormat ?? tournament?.matchFormat;
  if (fmt === 'single-set' || fmt === 'best-of-3' || fmt === 'single-set-30') return fmt;
  return 'best-of-3';
}

export function getSetsToWin(format: MatchFormat): number {
  return format === 'single-set' || format === 'single-set-30' ? 1 : 2;
}

export function getMinSetScore(format: MatchFormat): number {
  return format === 'single-set-30' ? 30 : 21;
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
  const minScore = 21;
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
  return 'Best of 3 (21pt)';
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
