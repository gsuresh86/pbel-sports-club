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
//   - maxPlayers (if set) caps how many players any team can hold; once a team
//     is full it is skipped in all assignment phases.

export interface AssignTeam {
  id: string;
  /** Player ids already on the team. */
  players: string[];
  /** Hard cap on team size. Undefined means no limit. */
  maxPlayers?: number;
}

/** Capped tiers, in the priority order used when a team still needs players. */
export const TOP_TIERS = ['expert', 'advanced', 'intermediate'] as const;

const isTopTier = (level: string): boolean => (TOP_TIERS as readonly string[]).includes(level);

/** The set of top tiers that appear among the given player levels. */
export function topTiersAvailable(levels: Iterable<string>): Set<string> {
  const present = new Set<string>();
  for (const level of levels) if (isTopTier(level)) present.add(level);
  return present;
}

const hasCapacity = (t: AssignTeam): boolean =>
  t.maxPlayers == null || t.players.length < t.maxPlayers;

const smallest = <T extends AssignTeam>(teams: T[]): T =>
  teams.reduce((min, t) => (t.players.length < min.players.length ? t : min), teams[0]);

/**
 * Picks the team a single player should join under the quota rules.
 *  - A top-tier player goes to the smallest team that does not yet have that tier
 *    and still has capacity. Returns `undefined` when every team is full or
 *    already holds that tier (the player is surplus / unplaceable).
 *  - A beginner goes to the smallest team that has a free slot AFTER reserving one
 *    slot for each top tier the team still lacks that is listed in
 *    `availableTopTiers` (i.e. a tier that still has an unassigned player). This
 *    stops a beginner from filling the last slot a missing expert/advanced/
 *    intermediate should occupy. When a tier is no longer available, its slot is
 *    no longer reserved and beginners fill the team to maxPlayers.
 * Returns `undefined` when there are no eligible teams.
 */
export function selectQuotaTeamForPlayer<T extends AssignTeam>(
  playerLevel: string,
  teams: T[],
  levelOf: (playerId: string) => string,
  availableTopTiers: ReadonlySet<string> = new Set(),
): T | undefined {
  if (teams.length === 0) return undefined;
  const tiersOf = (t: T) => new Set(t.players.map(levelOf));

  if (isTopTier(playerLevel)) {
    const lacking = teams.filter(t => hasCapacity(t) && !tiersOf(t).has(playerLevel));
    if (lacking.length === 0) return undefined; // surplus of this tier, or all full
    return smallest(lacking);
  }

  // Beginner: reserve one slot for each missing-but-still-available top tier.
  const beginnerFits = (t: T) => {
    if (t.maxPlayers == null) return true;
    const have = tiersOf(t);
    const reserved = TOP_TIERS.filter(tier => availableTopTiers.has(tier) && !have.has(tier)).length;
    return t.players.length < t.maxPlayers - reserved;
  };
  const open = teams.filter(beginnerFits);
  if (open.length === 0) return undefined;
  return smallest(open);
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
  const cap = (t: AssignTeam) => t.maxPlayers ?? Infinity;
  const localHasCapacity = (t: AssignTeam) => local[t.id].length < cap(t);
  const used = new Set<string>();
  const tiersOf = (teamId: string) => new Set(local[teamId].map(levelOf));

  // One of each top tier per team (skip teams that are full or already have it).
  for (const tier of TOP_TIERS) {
    for (const team of teams) {
      if (!localHasCapacity(team)) continue;
      if (tiersOf(team.id).has(tier)) continue;
      const pid = unassignedIds.find(id => !used.has(id) && levelOf(id) === tier);
      if (!pid) continue; // no more players of this tier; team goes without
      used.add(pid);
      local[team.id].push(pid);
    }
  }

  // Remaining (beginners + any surplus): assign equally to teams that still have capacity.
  const remaining = unassignedIds.filter(id => !used.has(id) && !isTopTier(levelOf(id)));
  for (const id of remaining) {
    const eligible = teams.filter(localHasCapacity);
    if (eligible.length === 0) break; // all teams full
    const team = eligible.reduce(
      (min, t) => (local[t.id].length < local[min.id].length ? t : min),
      eligible[0],
    );
    used.add(id);
    local[team.id].push(id);
  }

  // Anything still unused is surplus top-tier or unplaceable (all teams full).
  const unassigned = unassignedIds.filter(id => !used.has(id));
  return { assignments: local, unassigned };
}
