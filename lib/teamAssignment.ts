// Pure team-assignment logic extracted from the SpinWheel component so it can be
// unit-tested without React or Firestore. All three assignment paths in the
// component (round spin, single spin, auto-assign-all) build on these helpers.
//
// Composition rule: every team should hold at most one expert, one advanced and
// one intermediate player; all remaining slots are filled with beginners.
//   - If a top tier (expert/advanced/intermediate) has more players than there
//     are teams, the surplus is left UNASSIGNED (at most one per team).
//   - If a top tier has fewer players than teams, some teams simply go without.
//   - Every beginner is assigned, spread evenly so team sizes stay balanced.

export interface AssignTeam {
  id: string;
  /** Player ids already on the team. */
  players: string[];
}

/** Capped tiers, in the priority order used when a team still needs players. */
export const TOP_TIERS = ['expert', 'advanced', 'intermediate'] as const;

const isTopTier = (level: string): boolean => (TOP_TIERS as readonly string[]).includes(level);

const smallest = <T extends AssignTeam>(teams: T[]): T =>
  teams.reduce((min, t) => (t.players.length < min.players.length ? t : min), teams[0]);

/**
 * Picks the team a single player should join under the quota rules.
 *  - A beginner goes to the smallest team.
 *  - A top-tier player goes to the smallest team that does not yet have that
 *    tier. If every team already has the tier, returns `undefined` (the player
 *    is surplus and should be left unassigned).
 * Returns `undefined` when there are no teams.
 */
export function selectQuotaTeamForPlayer<T extends AssignTeam>(
  playerLevel: string,
  teams: T[],
  levelOf: (playerId: string) => string,
): T | undefined {
  if (teams.length === 0) return undefined;
  if (!isTopTier(playerLevel)) {
    // beginner (or any non-capped level): just balance team sizes
    return smallest(teams);
  }
  const lacking = teams.filter(t => !new Set(t.players.map(levelOf)).has(playerLevel));
  if (lacking.length === 0) return undefined; // surplus of this tier
  return smallest(lacking);
}

/**
 * Picks the best available player to add to a team (used by the round spin,
 * which assigns one player per team per spin).
 *  - Prefers a top tier the team still lacks, in expert > advanced > intermediate
 *    order, so each team accumulates one of each.
 *  - Otherwise falls back to a beginner.
 * `availablePlayerIds` should already be in the desired (e.g. shuffled) order.
 * Returns `undefined` when nothing suitable is available (e.g. only surplus
 * top-tier players remain and the team already has those tiers).
 */
export function selectQuotaPlayerForTeam(
  availablePlayerIds: string[],
  teamPlayerIds: string[],
  levelOf: (playerId: string) => string,
): string | undefined {
  const have = new Set(teamPlayerIds.map(levelOf));
  for (const tier of TOP_TIERS) {
    if (have.has(tier)) continue;
    const pid = availablePlayerIds.find(id => levelOf(id) === tier);
    if (pid) return pid;
  }
  return availablePlayerIds.find(id => !isTopTier(levelOf(id)));
}

/**
 * Assigns every id in `unassignedIds` to a team in one batch and returns the
 * resulting team -> player-id map plus the ids that could not be placed
 * (surplus expert/advanced/intermediate beyond one per team). Input teams are
 * not mutated.
 */
export function assignByTierQuota(
  unassignedIds: string[],
  teams: AssignTeam[],
  levelOf: (playerId: string) => string,
): { assignments: Record<string, string[]>; unassigned: string[] } {
  const local: Record<string, string[]> = Object.fromEntries(
    teams.map(t => [t.id, [...t.players]]),
  );
  const used = new Set<string>();
  const tiersOf = (teamId: string) => new Set(local[teamId].map(levelOf));

  // One of each top tier per team (teams lacking the tier, in order).
  for (const tier of TOP_TIERS) {
    for (const team of teams) {
      if (tiersOf(team.id).has(tier)) continue;
      const pid = unassignedIds.find(id => !used.has(id) && levelOf(id) === tier);
      if (!pid) continue; // no more players of this tier; team goes without
      used.add(pid);
      local[team.id].push(pid);
    }
  }

  // Beginners: assign all, always to the currently smallest team.
  const beginners = unassignedIds.filter(id => !used.has(id) && !isTopTier(levelOf(id)));
  for (const id of beginners) {
    const team = teams.reduce(
      (min, t) => (local[t.id].length < local[min.id].length ? t : min),
      teams[0],
    );
    used.add(id);
    local[team.id].push(id);
  }

  // Anything still unused is surplus top-tier and stays unassigned.
  const unassigned = unassignedIds.filter(id => !used.has(id));
  return { assignments: local, unassigned };
}
