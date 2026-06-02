// Pure team-assignment logic extracted from the SpinWheel component so it can be
// unit-tested without React or Firestore.
//
// Players are distributed across teams so that each skill tier (as resolved by
// `levelOf`) is spread evenly: a player is placed on the smallest team that does
// not yet contain their tier, falling back to the smallest team overall. This
// keeps players of the same skill level from clustering on one team.

export interface AssignTeam {
  id: string;
  /** Player ids already on the team. */
  players: string[];
  /** Optional capacity; teams at capacity are skipped unless every team is full. */
  maxPlayers?: number | null;
}

/**
 * Assigns each id in `unassignedIds` (processed in order) to a team and returns
 * the resulting team -> player-id map. Input teams are not mutated.
 *
 * @param unassignedIds ordered ids of players to assign
 * @param teams         current team compositions
 * @param levelOf       resolves the skill tier for ANY player id (existing or new)
 */
export function distributePlayersAcrossTeams(
  unassignedIds: string[],
  teams: AssignTeam[],
  levelOf: (playerId: string) => string,
): Record<string, string[]> {
  const localPlayers: Record<string, string[]> = Object.fromEntries(
    teams.map(t => [t.id, [...t.players]]),
  );
  const levelsOf = (teamId: string) => new Set(localPlayers[teamId].map(levelOf));
  const isFull = (team: AssignTeam) =>
    team.maxPlayers != null && localPlayers[team.id].length >= team.maxPlayers;

  for (const id of unassignedIds) {
    const level = levelOf(id);
    const sorted = [...teams]
      .filter(t => !isFull(t))
      .sort((a, b) => localPlayers[a.id].length - localPlayers[b.id].length);
    // Fall back to all teams if every team is at capacity.
    const candidates = sorted.length > 0 ? sorted : [...teams].sort(
      (a, b) => localPlayers[a.id].length - localPlayers[b.id].length,
    );
    // Prefer a team without this tier; otherwise the smallest team, so each tier
    // is spread evenly across teams.
    const withoutLevel = candidates.filter(t => !levelsOf(t.id).has(level));
    const target = (withoutLevel.length > 0 ? withoutLevel : candidates)[0];
    localPlayers[target.id].push(id);
  }

  return localPlayers;
}
