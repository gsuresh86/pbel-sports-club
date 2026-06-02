import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distributePlayersAcrossTeams,
  selectTeamForPlayer,
  selectPlayerForTeam,
  type AssignTeam,
} from './teamAssignment.ts';

// --- helpers -------------------------------------------------------------

// Build empty teams t0..t{n-1}.
const makeTeams = (n: number): AssignTeam[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, players: [] as string[] }));

// Assign players given as a level sequence (each becomes an id "p<index>" with
// that level) and return the per-team list of levels.
function assignLevels(levels: string[], numTeams: number): string[][] {
  const ids = levels.map((_, i) => `p${i}`);
  const levelOf = (id: string) => levels[Number(id.slice(1))];
  const result = distributePlayersAcrossTeams(ids, makeTeams(numTeams), levelOf);
  return makeTeams(numTeams).map(t => result[t.id].map(levelOf));
}

// Worst max-min count of any single level across teams.
function maxPerLevelSpread(teams: string[][]): number {
  const levels = [...new Set(teams.flat())];
  let worst = 0;
  for (const L of levels) {
    const counts = teams.map(t => t.filter(x => x === L).length);
    worst = Math.max(worst, Math.max(...counts) - Math.min(...counts));
  }
  return worst;
}

// Generate all distinct permutations of an array (handles duplicates).
function* permutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield arr.slice();
    return;
  }
  const seen = new Set<T>();
  for (let i = 0; i < arr.length; i++) {
    if (seen.has(arr[i])) continue;
    seen.add(arr[i]);
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

// --- the regression scenario --------------------------------------------

test('does not cluster same-level players when a mix is possible', () => {
  // 2 teams, interleaved intermediate/advanced. The old "merged tier" logic put
  // both intermediates on one team and both advanced on the other.
  const teams = assignLevels(['intermediate', 'advanced', 'intermediate', 'advanced'], 2);
  for (const team of teams) {
    assert.equal(new Set(team).size, team.length, `team has duplicate levels: ${team}`);
  }
});

// --- exhaustive permutation validation ----------------------------------

const cases: { name: string; numTeams: number; levels: string[] }[] = [
  { name: '2 teams, int/adv x2', numTeams: 2, levels: ['intermediate', 'advanced', 'intermediate', 'advanced'] },
  { name: '2 teams, 2 each int/adv/beg', numTeams: 2, levels: ['intermediate', 'intermediate', 'advanced', 'advanced', 'beginner', 'beginner'] },
  { name: '3 teams, int/adv/expert x2', numTeams: 3, levels: ['intermediate', 'advanced', 'expert', 'intermediate', 'advanced', 'expert'] },
  { name: '2 teams, 3 int / 2 adv / 1 beg', numTeams: 2, levels: ['intermediate', 'intermediate', 'intermediate', 'advanced', 'advanced', 'beginner'] },
  { name: '3 teams, 2 each int/adv/beg', numTeams: 3, levels: ['intermediate', 'intermediate', 'advanced', 'advanced', 'beginner', 'beginner'] },
  { name: '4 teams, all four levels x2', numTeams: 4, levels: ['intermediate', 'advanced', 'expert', 'beginner', 'intermediate', 'advanced', 'expert', 'beginner'] },
];

for (const c of cases) {
  test(`every permutation keeps each level spread within 1 across teams — ${c.name}`, () => {
    const seen = new Set<string>();
    let count = 0;
    for (const order of permutations(c.levels)) {
      const key = order.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      count++;
      const spread = maxPerLevelSpread(assignLevels(order, c.numTeams));
      assert.ok(spread <= 1, `permutation [${key}] produced per-level spread ${spread} (>1)`);
    }
    assert.ok(count > 0, 'expected at least one permutation');
  });
}

// --- basic structural guarantees ----------------------------------------

test('assigns every player exactly once', () => {
  const levels = ['beginner', 'intermediate', 'advanced', 'expert', 'advanced', 'beginner'];
  const ids = levels.map((_, i) => `p${i}`);
  const levelOf = (id: string) => levels[Number(id.slice(1))];
  const result = distributePlayersAcrossTeams(ids, makeTeams(3), levelOf);
  const assigned = Object.values(result).flat().sort();
  assert.deepEqual(assigned, [...ids].sort());
});

test('keeps players already on teams and does not mutate the input', () => {
  const teams: AssignTeam[] = [
    { id: 't0', players: ['x0'] },
    { id: 't1', players: [] },
  ];
  const levelOf = () => 'advanced';
  const result = distributePlayersAcrossTeams(['p0'], teams, levelOf);
  assert.deepEqual(teams[0].players, ['x0'], 'input team was mutated');
  assert.ok(result.t0.includes('x0'));
  assert.equal(result.t0.length + result.t1.length, 2);
});

test('respects maxPlayers until every team is full', () => {
  const teams: AssignTeam[] = [
    { id: 't0', players: [], maxPlayers: 1 },
    { id: 't1', players: [], maxPlayers: 1 },
  ];
  const levelOf = () => 'beginner';
  const result = distributePlayersAcrossTeams(['p0', 'p1'], teams, levelOf);
  // Both teams reach capacity with one player each before any doubles up.
  assert.equal(result.t0.length, 1);
  assert.equal(result.t1.length, 1);
});

// --- selectTeamForPlayer (used by single spin + batch) -------------------

const lvl = (map: Record<string, string>) => (id: string) => map[id];

test('selectTeamForPlayer: picks the smallest team lacking the tier', () => {
  const teams: AssignTeam[] = [
    { id: 't0', players: ['a'] },        // has advanced
    { id: 't1', players: [] },           // empty, lacks advanced
  ];
  const t = selectTeamForPlayer('advanced', teams, lvl({ a: 'advanced' }));
  assert.equal(t?.id, 't1');
});

test('selectTeamForPlayer: falls back to smallest team when all have the tier', () => {
  const teams: AssignTeam[] = [
    { id: 't0', players: ['a', 'b'] },   // 2 players, has advanced
    { id: 't1', players: ['c'] },        // 1 player, has advanced
  ];
  const levels = lvl({ a: 'advanced', b: 'beginner', c: 'advanced' });
  const t = selectTeamForPlayer('advanced', teams, levels);
  assert.equal(t?.id, 't1', 'should pick the smaller team when neither lacks the tier');
});

test('selectTeamForPlayer: skips full teams unless all are full', () => {
  const teams: AssignTeam[] = [
    { id: 't0', players: ['a'], maxPlayers: 1 }, // full
    { id: 't1', players: [] },
  ];
  const t = selectTeamForPlayer('advanced', teams, lvl({ a: 'beginner' }));
  assert.equal(t?.id, 't1');
});

test('selectTeamForPlayer: returns undefined when there are no teams', () => {
  assert.equal(selectTeamForPlayer('advanced', [], () => 'advanced'), undefined);
});

// --- selectPlayerForTeam (used by round spin) ----------------------------

test('selectPlayerForTeam: prefers a player whose tier is not on the team', () => {
  // Team already has an advanced player; should pick the beginner.
  const picked = selectPlayerForTeam(['p0', 'p1'], ['x'], lvl({ p0: 'advanced', p1: 'beginner', x: 'advanced' }));
  assert.equal(picked, 'p1');
});

test('selectPlayerForTeam: falls back to the first available when all share the tier', () => {
  const levels = lvl({ p0: 'advanced', p1: 'advanced', x: 'advanced' });
  const picked = selectPlayerForTeam(['p0', 'p1'], ['x'], levels);
  assert.equal(picked, 'p0', 'preserves given (shuffled) order on fallback');
});

test('selectPlayerForTeam: returns undefined when no players are available', () => {
  assert.equal(selectPlayerForTeam([], ['x'], () => 'advanced'), undefined);
});
