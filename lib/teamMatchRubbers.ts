import type { LiveScore, Match, Registration } from '@/types';

export type RubberType = 'doubles' | 'single';

export const TEAM_RUBBER_SEQUENCE: ReadonlyArray<{ rubberNumber: number; rubberType: RubberType }> = [
  { rubberNumber: 1, rubberType: 'doubles' },
  { rubberNumber: 2, rubberType: 'single' },
  { rubberNumber: 3, rubberType: 'doubles' },
  { rubberNumber: 4, rubberType: 'single' },
  { rubberNumber: 5, rubberType: 'doubles' },
];

export interface RubberLineupSlot {
  rubberNumber: number;
  rubberType: RubberType;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
}

export function isTeamTieMatch(match: Match, teamIds: Set<string>): boolean {
  return match.matchKind === 'team-tie' || (teamIds.has(match.player1Id) && teamIds.has(match.player2Id));
}

export function isRubberMatch(match: Match): boolean {
  return match.matchKind === 'rubber' || !!match.parentMatchId;
}

export function rubberTypeLabel(type: RubberType): string {
  return type === 'doubles' ? 'Doubles' : 'Singles';
}

export function playerName(registrations: Registration[], id: string): string {
  return registrations.find(r => r.id === id)?.name ?? 'Unknown';
}

export function formatRubberPlayers(
  type: RubberType,
  teamPlayerIds: string[],
  registrations: Registration[],
): string {
  const names = teamPlayerIds.map(id => playerName(registrations, id));
  return type === 'doubles' ? names.join(' & ') : names[0] ?? '—';
}

export function validateRubberLineup(lineup: RubberLineupSlot[]): string | null {
  if (lineup.length !== TEAM_RUBBER_SEQUENCE.length) {
    return `Expected ${TEAM_RUBBER_SEQUENCE.length} rubbers`;
  }

  for (let i = 0; i < TEAM_RUBBER_SEQUENCE.length; i++) {
    const expected = TEAM_RUBBER_SEQUENCE[i];
    const slot = lineup[i];
    if (!slot || slot.rubberNumber !== expected.rubberNumber || slot.rubberType !== expected.rubberType) {
      return `Rubber ${i + 1} must be ${rubberTypeLabel(expected.rubberType)}`;
    }
    const required = expected.rubberType === 'doubles' ? 2 : 1;
    if (slot.team1PlayerIds.length !== required || slot.team2PlayerIds.length !== required) {
      return `Rubber ${expected.rubberNumber}: select ${required} player${required === 1 ? '' : 's'} per team`;
    }
    if (new Set(slot.team1PlayerIds).size !== slot.team1PlayerIds.length) {
      return `Rubber ${expected.rubberNumber}: duplicate players on team 1`;
    }
    if (new Set(slot.team2PlayerIds).size !== slot.team2PlayerIds.length) {
      return `Rubber ${expected.rubberNumber}: duplicate players on team 2`;
    }
  }
  return null;
}

/** Rebuild lineup editor state from existing rubber match documents. */
export function lineupFromRubbers(rubbers: Match[]): RubberLineupSlot[] {
  return [...rubbers]
    .sort((a, b) => (a.rubberNumber ?? 0) - (b.rubberNumber ?? 0))
    .map(r => ({
      rubberNumber: r.rubberNumber!,
      rubberType: r.rubberType!,
      team1PlayerIds:
        r.rubberType === 'doubles'
          ? [r.player1Id, r.player1PartnerId].filter((id): id is string => !!id)
          : [r.player1Id],
      team2PlayerIds:
        r.rubberType === 'doubles'
          ? [r.player2Id, r.player2PartnerId].filter((id): id is string => !!id)
          : [r.player2Id],
    }));
}

function team1PlayerNames(rubber: Match): Set<string> {
  return new Set([rubber.player1Name, rubber.player1PartnerName].filter(Boolean) as string[]);
}

function winnerNameOnTeam1(rubber: Match, winnerName: string): boolean {
  return team1PlayerNames(rubber).has(winnerName);
}

function formatPointScore(score: number) {
  return score.toString().padStart(2, '0');
}

export function countRubbersWon(
  rubbers: Match[],
  rubberLiveScores?: Map<string, LiveScore>
): { team1: number; team2: number } {
  let team1 = 0;
  let team2 = 0;
  for (const rubber of rubbers) {
    const side = rubberWinnerSide(rubber, rubberLiveScores?.get(rubber.id));
    if (side === 1) team1++;
    else if (side === 2) team2++;
  }
  return { team1, team2 };
}

export function rubberWinnerSide(rubber: Match, liveScore?: LiveScore | null): 1 | 2 | null {
  if (liveScore?.winnerName) {
    return winnerNameOnTeam1(rubber, liveScore.winnerName) ? 1 : 2;
  }
  if (rubber.status === 'completed') {
    if ((rubber.player1Score ?? 0) > (rubber.player2Score ?? 0)) return 1;
    if ((rubber.player2Score ?? 0) > (rubber.player1Score ?? 0)) return 2;
    if (rubber.winner) {
      return winnerNameOnTeam1(rubber, rubber.winner) ? 1 : 2;
    }
  }
  return null;
}

/** Score line for a rubber row — prefers live score doc when present. */
export function rubberScoreLine(rubber: Match, liveScore?: LiveScore | null): string {
  if (liveScore) {
    const inProgress = liveScore.isLive && !liveScore.winnerName;
    const setsWon = inProgress
      ? `${liveScore.player1Sets}–${liveScore.player2Sets}`
      : `${rubber.player1Score ?? liveScore.player1Sets}–${rubber.player2Score ?? liveScore.player2Sets}`;
    const p1 = liveScore.player1CurrentScore ?? 0;
    const p2 = liveScore.player2CurrentScore ?? 0;
    if (p1 > 0 || p2 > 0 || inProgress) {
      return `${setsWon} (${formatPointScore(p1)}–${formatPointScore(p2)})`;
    }
  }
  if (rubber.status === 'completed') {
    const setsWon = `${rubber.player1Score ?? 0}–${rubber.player2Score ?? 0}`;
    const setScores = rubber.sets?.map(s => `${s.player1Score}–${s.player2Score}`).join(', ');
    return setScores ? `${setsWon} (${setScores})` : setsWon;
  }
  if (rubber.status === 'live') {
    const lastSet = rubber.sets?.[rubber.sets.length - 1];
    const setsWon = `${rubber.player1Score ?? 0}–${rubber.player2Score ?? 0}`;
    if (lastSet) {
      return `${setsWon} (${lastSet.player1Score}–${lastSet.player2Score})`;
    }
    return setsWon;
  }
  return '—';
}
