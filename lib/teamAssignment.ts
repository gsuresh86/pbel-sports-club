// Pure team-assignment logic extracted from the SpinWheel component so it can be
// unit-tested without React or Firestore. All three assignment paths in the
// component (round spin, single spin, auto-assign-all) build on these helpers.
//
// The goal is to spread each skill tier (as resolved by `levelOf`) evenly across
// teams, so players of the same skill level don't cluster on one team.

export interface AssignTeam {
  id: string;
  /** Player ids already on the team. */
  players: string[];
  /** Optional capacity; teams at capacity are skipped unless every team is full. */
  maxPlayers?: number | null;
}

/**
 * Picks the team a player of `playerLevel` should join: the smallest team that
 * does not yet contain that tier, falling back to the smallest team overall.
 * Full teams are skipped unless every team is full. Returns `undefined` when
 * there are no teams.
 */
export function selectTeamForPlayer<T extends AssignTeam>(
  playerLevel: string,
  teams: T[],
  levelOf: (playerId: string) => string,
): T | undefined {
  if (teams.length === 0) return undefined;
  const isFull = (t: T) => t.maxPlayers != null && t.players.length >= t.maxPlayers;
  const available = teams.filter(t => !isFull(t));
  const pool = available.length > 0 ? available : teams;
  const withoutLevel = pool.filter(t => !new Set(t.players.map(levelOf)).has(playerLevel));
  const candidates = withoutLevel.length > 0 ? withoutLevel : pool;
  return candidates.reduce((min, t) => (t.players.length < min.players.length ? t : min), candidates[0]);
}

/**
 * Picks the best available player for a team: the first whose tier isn't already
 * on the team, falling back to the first available player. `availablePlayerIds`
 * should already be in the desired (e.g. shuffled) order. Returns `undefined`
 * when no players are available.
 */
export function selectPlayerForTeam(
  availablePlayerIds: string[],
  teamPlayerIds: string[],
  levelOf: (playerId: string) => string,
): string | undefined {
  const teamLevels = new Set(teamPlayerIds.map(levelOf));
  return availablePlayerIds.find(id => !teamLevels.has(levelOf(id))) ?? availablePlayerIds[0];
}

/**
 * Assigns each id in `unassignedIds` (processed in order) to a team via
 * {@link selectTeamForPlayer} and returns the resulting team -> player-id map.
 * Input teams are not mutated.
 */
export function distributePlayersAcrossTeams(
  unassignedIds: string[],
  teams: AssignTeam[],
  levelOf: (playerId: string) => string,
): Record<string, string[]> {
  const localPlayers: Record<string, string[]> = Object.fromEntries(
    teams.map(t => [t.id, [...t.players]]),
  );
  for (const id of unassignedIds) {
    const views: AssignTeam[] = teams.map(t => ({
      id: t.id,
      players: localPlayers[t.id],
      maxPlayers: t.maxPlayers,
    }));
    const target = selectTeamForPlayer(levelOf(id), views, levelOf);
    if (target) localPlayers[target.id].push(id);
  }
  return localPlayers;
}
