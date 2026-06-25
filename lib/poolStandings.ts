import type { CategoryType, Match, Pool, Team } from '@/types';
import { isRubberMatch } from '@/lib/teamMatchRubbers';

export const TEAM_CATEGORIES: CategoryType[] = [
  'mens-team', 'womens-team', 'kids-team-u13', 'kids-team-u18', 'open-team',
];

export function isTeamCategory(cat: string): boolean {
  return TEAM_CATEGORIES.includes(cat as CategoryType);
}

export interface PoolStandingRow {
  id: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
  points: number;
  nrr: number;
}

function emptyRow(id: string, name: string): PoolStandingRow {
  return {
    id, name, played: 0, won: 0, lost: 0, gamesWon: 0, gamesLost: 0, points: 0,
    pointsFor: 0, pointsAgainst: 0, pointDifference: 0, nrr: 0,
  };
}

function ensureRow(map: Map<string, PoolStandingRow>, id: string, name: string): PoolStandingRow {
  if (!map.has(id)) map.set(id, emptyRow(id, name));
  return map.get(id)!;
}

export function computeNrr(pointsFor: number, pointsAgainst: number): number {
  if (pointsAgainst <= 0) return pointsFor > 0 ? pointsFor : 0;
  return pointsFor / pointsAgainst;
}

export function formatNrr(nrr: number): string {
  return nrr.toFixed(3);
}

function setPoints(match: Match): { p1: number; p2: number } {
  const sets = match.sets ?? [];
  return {
    p1: sets.reduce((sum, s) => sum + (s.player1Score ?? 0), 0),
    p2: sets.reduce((sum, s) => sum + (s.player2Score ?? 0), 0),
  };
}

function countRubberWins(rubbers: Match[]): { team1: number; team2: number } {
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

function isTeamTieResolved(tie: Match, rubbers: Match[]): boolean {
  if (tie.status === 'completed') return true;
  const { team1, team2 } = countRubberWins(rubbers);
  return team1 >= 3 || team2 >= 3 || (team1 + team2 >= 5 && rubbers.every(r => r.status === 'completed'));
}

function applyIndividualResult(
  map: Map<string, PoolStandingRow>,
  winnerId: string,
  loserId: string,
  winnerName: string,
  loserName: string,
  winnerSets: number,
  loserSets: number,
  winnerPoints: number,
  loserPoints: number,
) {
  const w = ensureRow(map, winnerId, winnerName);
  const l = ensureRow(map, loserId, loserName);
  w.played++; l.played++;
  w.won++; l.lost++;
  w.points += 2;
  w.gamesWon += winnerSets;
  w.gamesLost += loserSets;
  l.gamesWon += loserSets;
  l.gamesLost += winnerSets;
  w.pointsFor += winnerPoints;
  w.pointsAgainst += loserPoints;
  l.pointsFor += loserPoints;
  l.pointsAgainst += winnerPoints;
}

function applyTeamTieResult(
  map: Map<string, PoolStandingRow>,
  team1Id: string,
  team2Id: string,
  team1Name: string,
  team2Name: string,
  team1Rubbers: number,
  team2Rubbers: number,
  team1Points: number,
  team2Points: number,
) {
  const t1 = ensureRow(map, team1Id, team1Name);
  const t2 = ensureRow(map, team2Id, team2Name);
  t1.played++; t2.played++;
  t1.gamesWon += team1Rubbers;
  t1.gamesLost += team2Rubbers;
  t2.gamesWon += team2Rubbers;
  t2.gamesLost += team1Rubbers;
  t1.pointsFor += team1Points;
  t1.pointsAgainst += team2Points;
  t2.pointsFor += team2Points;
  t2.pointsAgainst += team1Points;

  if (team1Rubbers > team2Rubbers) {
    t1.won++; t1.points += 2;
    t2.lost++;
  } else if (team2Rubbers > team1Rubbers) {
    t2.won++; t2.points += 2;
    t1.lost++;
  }
}

function finalizeRows(map: Map<string, PoolStandingRow>): PoolStandingRow[] {
  for (const row of map.values()) {
    row.pointDifference = row.pointsFor - row.pointsAgainst;
    row.nrr = computeNrr(row.pointsFor, row.pointsAgainst);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aGameDiff = a.gamesWon - a.gamesLost;
    const bGameDiff = b.gamesWon - b.gamesLost;
    if (bGameDiff !== aGameDiff) return bGameDiff - aGameDiff;
    if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
    if (b.won !== a.won) return b.won - a.won;
    return a.name.localeCompare(b.name);
  });
}

/** Standings for individual / doubles pool matches (set points drive NRR). */
export function computeIndividualPoolStandings(
  pool: Pool,
  matches: Match[],
  nameLookup: (id: string) => string,
): PoolStandingRow[] {
  const map = new Map<string, PoolStandingRow>();
  for (const id of pool.teams) ensureRow(map, id, nameLookup(id));

  const members = poolMemberIds(pool);
  const poolMatches = matches.filter(
    m => m.round === pool.name && m.status === 'completed' && !isRubberMatch(m) && !m.matchKind
      && isPoolMemberMatch(m, members),
  );

  for (const m of poolMatches) {
    const p1Sets = m.player1Score ?? 0;
    const p2Sets = m.player2Score ?? 0;
    const { p1, p2 } = setPoints(m);
    const p1Won = m.winner
      ? m.winner === m.player1Name
      : p1Sets > p2Sets;

    if (p1Won) {
      applyIndividualResult(map, m.player1Id, m.player2Id, m.player1Name, m.player2Name, p1Sets, p2Sets, p1, p2);
    } else {
      applyIndividualResult(map, m.player2Id, m.player1Id, m.player2Name, m.player1Name, p2Sets, p1Sets, p2, p1);
    }
  }

  return finalizeRows(map);
}

/** Standings for team pools: tie W/L from rubbers won; NRR from aggregate rubber set points. */
export function computeTeamPoolStandings(
  pool: Pool,
  matches: Match[],
  teams: Team[],
): PoolStandingRow[] {
  const map = new Map<string, PoolStandingRow>();
  const teamById = new Map(teams.map(t => [t.id, t]));

  for (const id of pool.teams) {
    const team = teamById.get(id);
    ensureRow(map, id, team?.name ?? `Team ${id.slice(0, 6)}`);
  }

  const rubbers = matches.filter(m => isRubberMatch(m) && m.round === pool.name);
  const rubbersByParent = rubbers.reduce((acc, r) => {
    const pid = r.parentMatchId!;
    const list = acc.get(pid) ?? [];
    list.push(r);
    acc.set(pid, list);
    return acc;
  }, new Map<string, Match[]>());

  const members = poolMemberIds(pool);
  const teamTies = matches.filter(
    m => m.round === pool.name && !isRubberMatch(m) && (
      m.matchKind === 'team-tie' ||
      (teamById.has(m.player1Id) && teamById.has(m.player2Id))
    ) && isPoolMemberMatch(m, members),
  );

  for (const tie of teamTies) {
    const tieRubbers = rubbersByParent.get(tie.id) ?? [];
    if (!isTeamTieResolved(tie, tieRubbers)) continue;

    let team1Rubbers: number;
    let team2Rubbers: number;
    if (tie.status === 'completed' && tie.player1Score != null && tie.player2Score != null) {
      team1Rubbers = tie.player1Score;
      team2Rubbers = tie.player2Score;
    } else {
      const counts = countRubberWins(tieRubbers);
      team1Rubbers = counts.team1;
      team2Rubbers = counts.team2;
    }

    let team1Points = 0;
    let team2Points = 0;
    for (const rubber of tieRubbers) {
      if (rubber.status !== 'completed') continue;
      const { p1, p2 } = setPoints(rubber);
      team1Points += p1;
      team2Points += p2;
    }

    applyTeamTieResult(
      map,
      tie.player1Id,
      tie.player2Id,
      tie.player1Name,
      tie.player2Name,
      team1Rubbers,
      team2Rubbers,
      team1Points,
      team2Points,
    );
  }

  return finalizeRows(map);
}

export function computePoolStandings(
  pool: Pool,
  matches: Match[],
  options: {
    isTeamCat: boolean;
    teams?: Team[];
    nameLookup?: (id: string) => string;
  },
): PoolStandingRow[] {
  if (options.isTeamCat) {
    return computeTeamPoolStandings(pool, matches, options.teams ?? []);
  }
  return computeIndividualPoolStandings(
    pool,
    matches,
    options.nameLookup ?? (id => id),
  );
}

function poolMemberIds(pool: Pool): Set<string> {
  return new Set(pool.teams);
}

function pairingKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function expectedPoolPairings(pool: Pool): Set<string> {
  const keys = new Set<string>();
  const ids = pool.teams;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      keys.add(pairingKey(ids[i], ids[j]));
    }
  }
  return keys;
}

function isPoolMemberMatch(match: Match, members: Set<string>): boolean {
  return members.has(match.player1Id) && members.has(match.player2Id);
}

function getIndividualPoolPlayMatches(pool: Pool, matches: Match[]): Match[] {
  const members = poolMemberIds(pool);
  return matches.filter(
    m => m.round === pool.name && !isRubberMatch(m) && !m.matchKind
      && m.status !== 'not-scheduled' && m.status !== 'cancelled'
      && isPoolMemberMatch(m, members),
  );
}

function getTeamPoolPlayMatches(pool: Pool, matches: Match[], teams: Team[]): Match[] {
  const teamById = new Map(teams.map(t => [t.id, t]));
  const members = poolMemberIds(pool);
  return matches.filter(
    m => m.round === pool.name && !isRubberMatch(m) && (
      m.matchKind === 'team-tie' ||
      (teamById.has(m.player1Id) && teamById.has(m.player2Id))
    ) && m.status !== 'not-scheduled' && m.status !== 'cancelled'
      && isPoolMemberMatch(m, members),
  );
}

/** True when every pool play match is finished (individual: completed; team: tie resolved). */
export function isPoolPlayComplete(
  pool: Pool,
  matches: Match[],
  options: { isTeamCat: boolean; teams?: Team[] },
): boolean {
  const expectedPairings = expectedPoolPairings(pool);
  if (expectedPairings.size === 0) return false;

  if (options.isTeamCat) {
    const teamTies = getTeamPoolPlayMatches(pool, matches, options.teams ?? []);
    if (teamTies.length < expectedPairings.size) return false;
    const rubbers = matches.filter(m => isRubberMatch(m) && m.round === pool.name);
    const rubbersByParent = rubbers.reduce((acc, r) => {
      const pid = r.parentMatchId!;
      const list = acc.get(pid) ?? [];
      list.push(r);
      acc.set(pid, list);
      return acc;
    }, new Map<string, Match[]>());
    const resolvedPairings = new Set<string>();
    for (const tie of teamTies) {
      if (!isTeamTieResolved(tie, rubbersByParent.get(tie.id) ?? [])) return false;
      resolvedPairings.add(pairingKey(tie.player1Id, tie.player2Id));
    }
    for (const key of expectedPairings) {
      if (!resolvedPairings.has(key)) return false;
    }
    return true;
  }

  const poolMatches = getIndividualPoolPlayMatches(pool, matches);
  const completedPairings = new Set<string>();
  for (const m of poolMatches) {
    if (m.status !== 'completed') return false;
    completedPairings.add(pairingKey(m.player1Id, m.player2Id));
  }
  for (const key of expectedPairings) {
    if (!completedPairings.has(key)) return false;
  }
  return true;
}
