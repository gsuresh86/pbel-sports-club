import type { Match, Registration } from '@/types';

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

export function countRubbersWon(rubbers: Match[]): { team1: number; team2: number } {
  let team1 = 0;
  let team2 = 0;
  for (const rubber of rubbers) {
    if (rubber.status !== 'completed' || !rubber.winner) continue;
    const team1Names = new Set(
      [rubber.player1Name, rubber.player1PartnerName].filter(Boolean) as string[],
    );
    if (team1Names.has(rubber.winner)) team1++;
    else team2++;
  }
  return { team1, team2 };
}
