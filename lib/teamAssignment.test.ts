import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignByTierQuota,
  selectQuotaTeamForPlayer,
  selectQuotaPlayerForTeam,
  TOP_TIERS,
  type AssignTeam,
} from './teamAssignment.ts';

// --- helpers -------------------------------------------------------------

const makeTeams = (n: number): AssignTeam[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, players: [] as string[] }));

// Run the batch assignment from a level sequence (each level -> id "p<index>").
function runQuota(levels: string[], numTeams: number) {
  const ids = levels.map((_, i) => `p${i}`);
  const levelOf = (id: string) => levels[Number(id.slice(1))];
  const { assignments, unassigned } = assignByTierQuota(ids, makeTeams(numTeams), levelOf);
  const teams = makeTeams(numTeams).map(t => assignments[t.id].map(levelOf));
  return { teams, unassigned: unassigned.map(levelOf), levelOf };
}

const count = (arr: string[], v: string) => arr.filter(x => x === v).length;

function* permutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) { yield arr.slice(); return; }
  const seen = new Set<T>();
  for (let i = 0; i < arr.length; i++) {
    if (seen.has(arr[i])) continue;
    seen.add(arr[i]);
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

// Asserts the quota composition rules for a finished assignment.
function assertQuota(teams: string[][], allLevels: string[], numTeams: number, unassigned: string[]) {
  // 1) at most one of each top tier per team
  for (const team of teams) {
    for (const tier of TOP_TIERS) {
      assert.ok(count(team, tier) <= 1, `team ${team} has >1 ${tier}`);
    }
  }
  // 2) exactly min(numTeams, available) teams hold each top tier
  for (const tier of TOP_TIERS) {
    const available = count(allLevels, tier);
    const teamsWith = teams.filter(t => t.includes(tier)).length;
    assert.equal(teamsWith, Math.min(numTeams, available), `wrong #teams with ${tier}`);
  }
  // 3) every beginner is assigned; 4) unassigned are exactly the surplus top-tier
  assert.equal(count(unassigned, 'beginner'), 0, 'a beginner was left unassigned');
  for (const tier of TOP_TIERS) {
    const surplus = Math.max(0, count(allLevels, tier) - numTeams);
    assert.equal(count(unassigned, tier), surplus, `wrong surplus for ${tier}`);
  }
}

// --- the requested composition ------------------------------------------

test('each team gets one expert, one advanced, one intermediate, rest beginners', () => {
  const levels = [
    'expert', 'advanced', 'intermediate', 'beginner', 'beginner',
    'expert', 'advanced', 'intermediate', 'beginner', 'beginner',
  ];
  const { teams, unassigned } = runQuota(levels, 2);
  for (const team of teams) {
    assert.equal(count(team, 'expert'), 1, `expected 1 expert: ${team}`);
    assert.equal(count(team, 'advanced'), 1, `expected 1 advanced: ${team}`);
    assert.equal(count(team, 'intermediate'), 1, `expected 1 intermediate: ${team}`);
    // remaining are all beginners
    const extras = team.filter(l => !['expert', 'advanced', 'intermediate'].includes(l));
    assert.ok(extras.every(l => l === 'beginner'), `non-beginner filler: ${team}`);
  }
  assert.deepEqual(unassigned, []);
});

// --- surplus / shortage --------------------------------------------------

test('surplus experts/advanced/intermediate beyond #teams are left unassigned', () => {
  // 2 teams, 4 experts -> 2 placed, 2 unassigned
  const { teams, unassigned } = runQuota(['expert', 'expert', 'expert', 'expert'], 2);
  assert.equal(teams.filter(t => t.includes('expert')).length, 2);
  assert.deepEqual(unassigned, ['expert', 'expert']);
});

test('shortage: fewer experts than teams means some teams have none, none wasted', () => {
  // 4 teams, 2 experts -> 2 teams get one, 0 unassigned
  const { teams, unassigned } = runQuota(['expert', 'expert'], 4);
  assert.equal(teams.filter(t => t.includes('expert')).length, 2);
  assert.deepEqual(unassigned, []);
});

test('all beginners are assigned and spread evenly across teams', () => {
  const levels = ['expert', 'advanced', 'intermediate', ...Array(8).fill('beginner')];
  const { teams } = runQuota(levels, 4);
  const begCounts = teams.map(t => count(t, 'beginner'));
  assert.equal(begCounts.reduce((a, b) => a + b, 0), 8, 'all beginners assigned');
  assert.ok(Math.max(...teams.map(t => t.length)) - Math.min(...teams.map(t => t.length)) <= 1,
    `team sizes not balanced: ${JSON.stringify(teams.map(t => t.length))}`);
});

// --- exhaustive permutation validation ----------------------------------

const cases: { name: string; numTeams: number; levels: string[] }[] = [
  { name: '2 teams, full set x2', numTeams: 2, levels: ['expert', 'advanced', 'intermediate', 'beginner', 'expert', 'advanced', 'intermediate', 'beginner'] },
  { name: '3 teams, surplus experts', numTeams: 3, levels: ['expert', 'expert', 'expert', 'expert', 'advanced', 'intermediate', 'beginner'] },
  { name: '2 teams, shortage of intermediate', numTeams: 2, levels: ['expert', 'expert', 'advanced', 'advanced', 'intermediate', 'beginner', 'beginner'] },
  { name: '3 teams, beginner heavy', numTeams: 3, levels: ['expert', 'advanced', 'intermediate', 'beginner', 'beginner', 'beginner'] },
];

for (const c of cases) {
  test(`composition holds for every permutation — ${c.name}`, () => {
    const seen = new Set<string>();
    let n = 0;
    for (const order of permutations(c.levels)) {
      const key = order.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      n++;
      const { teams, unassigned } = runQuota(order, c.numTeams);
      assertQuota(teams, c.levels, c.numTeams, unassigned);
    }
    assert.ok(n > 0);
  });
}

// --- primitives ----------------------------------------------------------

const lvl = (map: Record<string, string>) => (id: string) => map[id];

test('selectQuotaTeamForPlayer: top-tier player goes to a team lacking that tier', () => {
  const teams: AssignTeam[] = [{ id: 't0', players: ['a'] }, { id: 't1', players: [] }];
  const t = selectQuotaTeamForPlayer('expert', teams, lvl({ a: 'expert' }));
  assert.equal(t?.id, 't1');
});

test('selectQuotaTeamForPlayer: surplus top-tier player returns undefined', () => {
  const teams: AssignTeam[] = [{ id: 't0', players: ['a'] }, { id: 't1', players: ['b'] }];
  const t = selectQuotaTeamForPlayer('expert', teams, lvl({ a: 'expert', b: 'expert' }));
  assert.equal(t, undefined);
});

test('selectQuotaTeamForPlayer: beginner goes to the smallest team', () => {
  const teams: AssignTeam[] = [{ id: 't0', players: ['a', 'b'] }, { id: 't1', players: ['c'] }];
  const t = selectQuotaTeamForPlayer('beginner', teams, lvl({ a: 'expert', b: 'beginner', c: 'advanced' }));
  assert.equal(t?.id, 't1');
});

test('selectQuotaPlayerForTeam: prefers a needed top tier (expert > advanced > intermediate)', () => {
  const levels = lvl({ p0: 'beginner', p1: 'intermediate', p2: 'advanced', x: 'expert' });
  // Team already has an expert; should pick advanced over intermediate/beginner.
  const picked = selectQuotaPlayerForTeam(['p0', 'p1', 'p2'], ['x'], levels);
  assert.equal(picked, 'p2');
});

test('selectQuotaPlayerForTeam: falls back to a beginner once top tiers are present', () => {
  const levels = lvl({ p0: 'expert', p1: 'beginner', x: 'expert', y: 'advanced', z: 'intermediate' });
  // Team already has all three top tiers; surplus expert p0 is skipped, beginner chosen.
  const picked = selectQuotaPlayerForTeam(['p0', 'p1'], ['x', 'y', 'z'], levels);
  assert.equal(picked, 'p1');
});

test('selectQuotaPlayerForTeam: returns undefined when only surplus top-tier remain', () => {
  const levels = lvl({ p0: 'expert', x: 'expert', y: 'advanced', z: 'intermediate' });
  const picked = selectQuotaPlayerForTeam(['p0'], ['x', 'y', 'z'], levels);
  assert.equal(picked, undefined);
});

// --- structural guarantees ----------------------------------------------

test('keeps players already on teams and does not mutate the input', () => {
  const teams: AssignTeam[] = [{ id: 't0', players: ['x0'] }, { id: 't1', players: [] }];
  const levelOf = (id: string) => (id === 'x0' ? 'expert' : 'beginner');
  const { assignments } = assignByTierQuota(['p0'], teams, levelOf);
  assert.deepEqual(teams[0].players, ['x0'], 'input team was mutated');
  assert.ok(assignments.t0.includes('x0'));
});

test('does not add a second expert to a team that already has one', () => {
  const teams: AssignTeam[] = [{ id: 't0', players: ['x0'] }];
  const levelOf = (id: string) => 'expert';
  const { assignments, unassigned } = assignByTierQuota(['p0'], teams, levelOf);
  assert.deepEqual(assignments.t0, ['x0']);
  assert.deepEqual(unassigned, ['p0']);
});
