import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignByTierQuota,
  selectQuotaTeamForPlayer,
  selectQuotaPlayerForTeam,
  topTiersAvailable,
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

test('selectQuotaTeamForPlayer: a beginner does NOT take a slot reserved for an available expert', () => {
  // Team has 5/6, no expert yet; an expert is still available -> last slot reserved.
  const teams: AssignTeam[] = [{ id: 't0', players: ['a', 'b', 'c', 'd', 'e'], maxPlayers: 6 }];
  const levelOf = (_id: string) => 'beginner';
  const blocked = selectQuotaTeamForPlayer('beginner', teams, levelOf, new Set(['expert']));
  assert.equal(blocked, undefined, 'beginner should not fill the reserved expert slot');
  // The expert itself still fits that reserved slot.
  const expertTeam = selectQuotaTeamForPlayer('expert', teams, levelOf, new Set(['expert']));
  assert.equal(expertTeam?.id, 't0');
  // Once no expert is available, the slot is freed for a beginner.
  const freed = selectQuotaTeamForPlayer('beginner', teams, levelOf, new Set());
  assert.equal(freed?.id, 't0');
});

test('selectQuotaTeamForPlayer: a team that already has the expert does not reserve for it', () => {
  // 5/6 and already has an expert -> the last slot is free for a beginner even
  // though an expert is still available (it must go to a team that lacks one).
  const teams: AssignTeam[] = [{ id: 't0', players: ['x', 'b', 'c', 'd', 'e'], maxPlayers: 6 }];
  const levelOf = (id: string) => (id === 'x' ? 'expert' : 'beginner');
  const t = selectQuotaTeamForPlayer('beginner', teams, levelOf, new Set(['expert']));
  assert.equal(t?.id, 't0');
});

test('topTiersAvailable: reports only the top tiers present among levels', () => {
  assert.deepEqual(
    [...topTiersAvailable(['beginner', 'advanced', 'beginner', 'expert'])].sort(),
    ['advanced', 'expert'],
  );
  assert.deepEqual([...topTiersAvailable(['beginner', 'beginner'])], []);
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

// --- maxPlayers cap ---------------------------------------------------------

test('maxPlayers: team at capacity is skipped for top-tier assignment', () => {
  // t0 is already full (maxPlayers=1); expert must go to t1
  const teams: AssignTeam[] = [
    { id: 't0', players: ['a'], maxPlayers: 1 },
    { id: 't1', players: [] },
  ];
  const levelOf = (id: string) => (id === 'p0' ? 'expert' : 'beginner');
  const { assignments, unassigned } = assignByTierQuota(['p0'], teams, levelOf);
  assert.ok(!assignments.t0.includes('p0'), 't0 is full, should not receive the expert');
  assert.ok(assignments.t1.includes('p0'), 't1 should receive the expert');
  assert.deepEqual(unassigned, []);
});

test('maxPlayers: beginners are not assigned to full teams', () => {
  // 2 teams, maxPlayers=2 each, 1 expert+1 beginner per team already present
  // one new beginner should go to whichever has space; both are full → unassigned
  const teams: AssignTeam[] = [
    { id: 't0', players: ['e0', 'b0'], maxPlayers: 2 },
    { id: 't1', players: ['e1', 'b1'], maxPlayers: 2 },
  ];
  const levelOf = (id: string) => (id.startsWith('e') ? 'expert' : 'beginner');
  const { assignments, unassigned } = assignByTierQuota(['p0'], teams, levelOf);
  assert.deepEqual(assignments.t0, ['e0', 'b0']);
  assert.deepEqual(assignments.t1, ['e1', 'b1']);
  assert.deepEqual(unassigned, ['p0']);
});

test('maxPlayers: stops filling a team once it reaches the cap', () => {
  // 2 teams maxPlayers=3; 1 expert + 4 beginners → each team gets expert then up to cap
  const teams: AssignTeam[] = [
    { id: 't0', players: [], maxPlayers: 3 },
    { id: 't1', players: [], maxPlayers: 3 },
  ];
  const levels = ['expert', 'beginner', 'beginner', 'beginner', 'beginner'];
  const ids = levels.map((_, i) => `p${i}`);
  const levelOf = (id: string) => levels[Number(id.slice(1))];
  const { assignments, unassigned } = assignByTierQuota(ids, teams, levelOf);
  assert.ok(assignments.t0.length <= 3, `t0 exceeds maxPlayers: ${assignments.t0}`);
  assert.ok(assignments.t1.length <= 3, `t1 exceeds maxPlayers: ${assignments.t1}`);
  assert.equal(unassigned.length, 0, 'all 5 players should be placed (2 teams × 3 cap = 6 slots)');
});

test('maxPlayers: selectQuotaTeamForPlayer returns undefined when all teams are full', () => {
  const teams: AssignTeam[] = [
    { id: 't0', players: ['a', 'b'], maxPlayers: 2 },
    { id: 't1', players: ['c', 'd'], maxPlayers: 2 },
  ];
  const levelOf = (_id: string) => 'beginner';
  const result = selectQuotaTeamForPlayer('beginner', teams, levelOf);
  assert.equal(result, undefined);
});

test('maxPlayers: undefined (no cap) behaves like unlimited', () => {
  const teams: AssignTeam[] = [{ id: 't0', players: [] }];
  const levels = Array(10).fill('beginner');
  const ids = levels.map((_, i) => `p${i}`);
  const levelOf = (_id: string) => 'beginner';
  const { assignments, unassigned } = assignByTierQuota(ids, teams, levelOf);
  assert.equal(assignments.t0.length, 10);
  assert.deepEqual(unassigned, []);
});

// --- requested composition: 1 expert + 1 advanced + 1 intermediate + (maxPlayers-3) beginners ---

test('full cap: each team is 1 expert + 1 advanced + 1 intermediate + (maxPlayers-3) beginners', () => {
  const MAX = 6;
  const levels = [
    ...Array(3).fill('expert'),
    ...Array(3).fill('advanced'),
    ...Array(3).fill('intermediate'),
    ...Array(12).fill('beginner'),
  ];
  const ids = levels.map((_, i) => `p${i}`);
  const levelOf = (id: string) => levels[Number(id.slice(1))];
  const teams: AssignTeam[] = Array.from({ length: 3 }, (_, i) => ({ id: `t${i}`, players: [], maxPlayers: MAX }));
  const { assignments, unassigned } = assignByTierQuota(ids, teams, levelOf);

  for (const t of teams) {
    const comp = assignments[t.id].map(levelOf);
    assert.equal(comp.length, MAX, `team not filled to cap: ${comp}`);
    assert.equal(count(comp, 'expert'), 1);
    assert.equal(count(comp, 'advanced'), 1);
    assert.equal(count(comp, 'intermediate'), 1);
    assert.equal(count(comp, 'beginner'), MAX - 3);
  }
  // 3 teams × 3 beginner slots = 9 placed, 3 beginners surplus
  assert.equal(unassigned.length, 3);
  assert.ok(unassigned.map(levelOf).every(l => l === 'beginner'));
});

test('full cap with shortage: missing top tier is back-filled with a beginner to reach maxPlayers', () => {
  const MAX = 6;
  // Only 1 expert for 3 teams; plenty of advanced/intermediate/beginner.
  const levels = [
    'expert',
    ...Array(3).fill('advanced'),
    ...Array(3).fill('intermediate'),
    ...Array(15).fill('beginner'),
  ];
  const ids = levels.map((_, i) => `p${i}`);
  const levelOf = (id: string) => levels[Number(id.slice(1))];
  const teams: AssignTeam[] = Array.from({ length: 3 }, (_, i) => ({ id: `t${i}`, players: [], maxPlayers: MAX }));
  const { assignments } = assignByTierQuota(ids, teams, levelOf);

  // Every team is filled to the cap...
  for (const t of teams) {
    assert.equal(assignments[t.id].length, MAX, `team ${t.id} not full`);
  }
  // ...exactly one team has the single expert; the other two have an extra beginner instead.
  const withExpert = teams.filter(t => assignments[t.id].map(levelOf).includes('expert'));
  assert.equal(withExpert.length, 1);
  for (const t of teams) {
    const comp = assignments[t.id].map(levelOf);
    const expected = comp.includes('expert') ? MAX - 3 : MAX - 2;
    assert.equal(count(comp, 'beginner'), expected, `team ${t.id} beginner count: ${comp}`);
  }
});
