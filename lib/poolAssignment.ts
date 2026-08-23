const TEAM_POOL_CATEGORIES = new Set([
  'mens-team',
  'womens-team',
  'kids-team-u13',
  'kids-team-u18',
  'open-team',
]);

export interface AssignablePool {
  id: string;
  category: string;
  teams: string[];
  maxTeams: number;
}

export interface AssignableRegistration {
  id: string;
  selectedCategory: string;
  registrationStatus?: string;
}

export interface PoolMemberUpdate {
  poolId: string;
  memberIds: string[];
}

export type ManualPoolAssignmentPlan =
  | { ok: true; updates: PoolMemberUpdate[] }
  | { ok: false; reason: 'pool-not-found' | 'pool-full' };

export type PoolCategoryNormalizer = (category: string) => string;

const identityCategory: PoolCategoryNormalizer = category => category;

const assignmentId = (id: string): string => id.trim();

export function isTeamPoolCategory(category: string): boolean {
  return TEAM_POOL_CATEGORIES.has(category);
}

/**
 * Registrations that can be assigned directly to individual/doubles pools.
 * Team-category registrations are assigned to a team before the team joins a pool.
 */
export function getUnassignedPoolRegistrations<T extends AssignableRegistration>(
  registrations: T[],
  pools: AssignablePool[],
  category?: string,
  normalizeCategory: PoolCategoryNormalizer = identityCategory,
): T[] {
  const categoryMatches = (left: string, right: string) =>
    normalizeCategory(left) === normalizeCategory(right);
  const assignedIds = new Set(
    pools
      .filter(
        pool =>
          !isTeamPoolCategory(normalizeCategory(pool.category)) &&
          (!category || categoryMatches(pool.category, category)),
      )
      .flatMap(pool => pool.teams)
      .map(assignmentId)
      .filter(Boolean),
  );

  return registrations.filter(registration => {
    if (
      registration.registrationStatus === 'rejected' ||
      isTeamPoolCategory(normalizeCategory(registration.selectedCategory)) ||
      (category && !categoryMatches(registration.selectedCategory, category))
    ) {
      return false;
    }

    return !assignedIds.has(assignmentId(registration.id));
  });
}

/**
 * Builds the pool writes for a one-at-a-time assignment. Assigning a member to
 * a new pool also removes it from every other pool in the same category.
 */
export function planManualPoolAssignment(
  pools: AssignablePool[],
  targetPoolId: string,
  memberId: string,
  normalizeCategory: PoolCategoryNormalizer = identityCategory,
): ManualPoolAssignmentPlan {
  const target = pools.find(pool => pool.id === targetPoolId);
  if (!target) return { ok: false, reason: 'pool-not-found' };

  const normalizedMemberId = assignmentId(memberId);
  const targetHasMember = target.teams.some(
    existingId => assignmentId(existingId) === normalizedMemberId,
  );
  if (targetHasMember) return { ok: true, updates: [] };

  if (target.teams.length >= target.maxTeams) {
    return { ok: false, reason: 'pool-full' };
  }

  const updates: PoolMemberUpdate[] = [{
    poolId: target.id,
    memberIds: [...target.teams, memberId],
  }];

  for (const pool of pools) {
    if (
      pool.id === target.id ||
      normalizeCategory(pool.category) !== normalizeCategory(target.category) ||
      !pool.teams.some(existingId => assignmentId(existingId) === normalizedMemberId)
    ) {
      continue;
    }

    updates.push({
      poolId: pool.id,
      memberIds: pool.teams.filter(
        existingId => assignmentId(existingId) !== normalizedMemberId,
      ),
    });
  }

  return { ok: true, updates };
}
