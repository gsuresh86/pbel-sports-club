import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCrossPoolQFPairings,
  buildQFPairings,
  buildSeededBracketPairings,
  filterKnockoutMatchesForCategory,
  getQualifyCount,
  previewKnockoutRound,
  bracketMatchNumbersMatch,
  getKnockoutPropagationUpdates,
  orderQfIndicesForSfBracket,
} from './knockoutBracket';
import type { Match, Pool } from '@/types';

test('getQualifyCount prefers pool override over category default', () => {
  const pool: Pool = {
    id: 'p1', tournamentId: 't1', name: 'A', category: 'mens-single',
    teams: [], maxTeams: 4, qualifyCount: 3, status: 'active', createdAt: new Date(), createdBy: 'u1',
  };
  assert.equal(getQualifyCount(pool, { 'mens-single': 2 }), 3);
  assert.equal(getQualifyCount({ ...pool, qualifyCount: undefined }, { 'mens-single': 1 }), 1);
  assert.equal(getQualifyCount({ ...pool, qualifyCount: undefined }), 2);
});

test('buildCrossPoolQFPairings rotates adjacent pools', () => {
  const mk = (pool: string, rank: number, id: string) => ({
    id, name: id, poolName: pool, poolRank: rank,
  });
  const qualified = [
    [mk('A', 1, 'A1'), mk('A', 2, 'A2')],
    [mk('B', 1, 'B1'), mk('B', 2, 'B2')],
    [mk('C', 1, 'C1'), mk('C', 2, 'C2')],
    [mk('D', 1, 'D1'), mk('D', 2, 'D2')],
  ];
  const pairings = buildCrossPoolQFPairings(qualified);
  assert.equal(pairings.length, 4);
  assert.deepEqual(
    pairings.map(p => [p.player1.id, p.player2.id]),
    [['A1', 'B2'], ['B1', 'C2'], ['C1', 'D2'], ['D1', 'A2']],
  );
});

test('buildSeededBracketPairings pairs top vs bottom seeds', () => {
  const participants = [
    { id: '1', name: 'S1' },
    { id: '2', name: 'S2' },
    { id: '3', name: 'S3' },
    { id: '4', name: 'S4' },
  ];
  const pairings = buildSeededBracketPairings(participants);
  assert.deepEqual(
    pairings.map(p => [p.player1.id, p.player2.id]),
    [['1', '4'], ['2', '3']],
  );
});

test('buildQFPairings uses cross-pool when qualify count is 2', () => {
  const qualified = [
    [{ id: 'A1', name: 'A1' }, { id: 'A2', name: 'A2' }],
    [{ id: 'B1', name: 'B1' }, { id: 'B2', name: 'B2' }],
  ];
  const pairings = buildQFPairings(qualified, 2);
  assert.deepEqual(
    pairings.map(p => [p.player1.id, p.player2.id]),
    [['A1', 'B2'], ['B1', 'A2']],
  );
});

test('previewKnockoutRound builds SF from completed QF winners', () => {
  const pools: Pool[] = [
    { id: 'p1', tournamentId: 't1', name: 'A', category: 'mens-single', teams: ['a', 'b'], maxTeams: 4, status: 'active', createdAt: new Date(), createdBy: 'u1' },
    { id: 'p2', tournamentId: 't1', name: 'B', category: 'mens-single', teams: ['c', 'd'], maxTeams: 4, status: 'active', createdAt: new Date(), createdBy: 'u1' },
  ];
  const matches: Match[] = [
    {
      id: 'qf1', tournamentId: 't1', round: 'QF', category: 'mens-single', matchNumber: 1,
      player1Id: 'a', player1Name: 'Alice', player2Id: 'd', player2Name: 'Diana',
      player1Score: 2, player2Score: 0, winner: 'Alice', status: 'completed',
      sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'qf2', tournamentId: 't1', round: 'QF', category: 'mens-single', matchNumber: 2,
      player1Id: 'c', player1Name: 'Carol', player2Id: 'b', player2Name: 'Bob',
      player1Score: 2, player2Score: 1, winner: 'Carol', status: 'completed',
      sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  const preview = previewKnockoutRound('SF', 'mens-single', pools, matches, {
    teams: [],
    registrations: [
      { id: 'a', name: 'Alice' } as any,
      { id: 'b', name: 'Bob' } as any,
      { id: 'c', name: 'Carol' } as any,
      { id: 'd', name: 'Diana' } as any,
    ],
  });
  assert.equal(preview.pairings.length, 1);
  assert.deepEqual(
    [preview.pairings[0].player1.name, preview.pairings[0].player2.name],
    ['Alice', 'Carol'],
  );
});

test('filterKnockoutMatchesForCategory keeps team-tie parent matches, excludes rubbers', () => {
  const base = {
    tournamentId: 't1',
    round: 'QF' as const,
    category: 'mens-team' as const,
    sets: [],
    scheduledTime: new Date(),
    venue: 'Court',
    updatedAt: new Date(),
    createdBy: 'u1',
  };
  const matches: Match[] = [
    {
      ...base,
      id: 'qf1',
      matchNumber: 'MT-Q-M1',
      player1Id: 't1', player1Name: 'Team A',
      player2Id: 't2', player2Name: 'Team B',
      matchKind: 'team-tie',
      status: 'completed',
      winner: 'Team A',
      player1Score: 3,
      player2Score: 2,
    },
    {
      ...base,
      id: 'rubber1',
      matchNumber: 1,
      player1Id: 'p1', player1Name: 'Player 1',
      player2Id: 'p2', player2Name: 'Player 2',
      matchKind: 'rubber',
      parentMatchId: 'qf1',
      status: 'completed',
    },
  ];
  const filtered = filterKnockoutMatchesForCategory(matches, 'QF', 'mens-team');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'qf1');
});

test('bracketMatchNumbersMatch links QF1 refs to numeric match numbers', () => {
  const qf: Match = {
    id: 'qf1',
    tournamentId: 't1',
    round: 'QF',
    category: 'mens-single',
    matchNumber: 1,
    player1Id: 'a',
    player1Name: 'Alice',
    player2Id: 'b',
    player2Name: 'Bob',
    status: 'scheduled',
    sets: [],
    scheduledTime: new Date(),
    venue: 'Court',
    updatedAt: new Date(),
    createdBy: 'u1',
  };
  assert.equal(bracketMatchNumbersMatch('QF1', qf), true);
  assert.equal(bracketMatchNumbersMatch('1', qf), true);
  assert.equal(bracketMatchNumbersMatch('QF2', qf), false);
});

test('getKnockoutPropagationUpdates fills SF slots when QF completes', () => {
  const qf: Match = {
    id: 'qf1',
    tournamentId: 't1',
    round: 'QF',
    category: 'mens-single',
    matchNumber: 'QF1',
    player1Id: 'a',
    player1Name: 'Alice',
    player2Id: 'b',
    player2Name: 'Bob',
    player1Score: 2,
    player2Score: 0,
    winner: 'Alice',
    status: 'completed',
    sets: [],
    scheduledTime: new Date(),
    venue: 'Court',
    updatedAt: new Date(),
    createdBy: 'u1',
  };
  const sf: Match = {
    id: 'sf1',
    tournamentId: 't1',
    round: 'SF',
    category: 'mens-single',
    matchNumber: 'SF1',
    player1Id: 'tbd-winner-QF1',
    player1Name: 'Winner of QF1',
    player2Id: 'tbd-winner-QF2',
    player2Name: 'Winner of QF2',
    status: 'scheduled',
    sets: [],
    scheduledTime: new Date(),
    venue: 'Court',
    updatedAt: new Date(),
    createdBy: 'u1',
  };
  const updates = getKnockoutPropagationUpdates(qf, [qf, sf]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].matchId, 'sf1');
  assert.equal(updates[0].player1Id, 'a');
  assert.equal(updates[0].player1Name, 'Alice');
});

test('orderQfIndicesForSfBracket pairs QF by SF config including resolved winners', () => {
  const qfBase = {
    tournamentId: 't1',
    round: 'QF' as const,
    category: 'boys-u13' as const,
    sets: [],
    scheduledTime: new Date(),
    venue: 'Court',
    updatedAt: new Date(),
    createdBy: 'u1',
  };
  const qfMatches: Match[] = [
    { ...qfBase, id: 'm1', matchNumber: 'BU13-Q-M1', player1Id: 'p1', player1Name: 'A', player2Id: 'p2', player2Name: 'B', status: 'scheduled' },
    { ...qfBase, id: 'm2', matchNumber: 'BU13-Q-M2', player1Id: 'p3', player1Name: 'C', player2Id: 'p4', player2Name: 'D', status: 'scheduled' },
    { ...qfBase, id: 'm3', matchNumber: 'BU13-Q-M3', player1Id: 'p5', player1Name: 'E', player2Id: 'p6', player2Name: 'Vihaan Burra', status: 'completed', winner: 'Vihaan Burra', player1Score: 0, player2Score: 1 },
    { ...qfBase, id: 'm4', matchNumber: 'BU13-Q-M4', player1Id: 'p7', player1Name: 'Kedar sai pinjala', player2Id: 'p8', player2Name: 'F', status: 'completed', winner: 'Kedar sai pinjala', player1Score: 1, player2Score: 0 },
  ];
  const sfMatches: Match[] = [
    {
      id: 'sf1', tournamentId: 't1', round: 'SF', category: 'boys-u13', matchNumber: 'BU13-S-M1',
      player1Id: 'tbd-winner-m1', player1Name: 'Winner of BU13-Q-M1',
      player2Id: 'p7', player2Name: 'Kedar sai pinjala',
      status: 'not-scheduled', sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'sf2', tournamentId: 't1', round: 'SF', category: 'boys-u13', matchNumber: 'BU13-S-M2',
      player1Id: 'tbd-winner-m2', player1Name: 'Winner of BU13-Q-M2',
      player2Id: 'p6', player2Name: 'Vihaan Burra',
      status: 'not-scheduled', sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  const order = orderQfIndicesForSfBracket(qfMatches, sfMatches);
  assert.deepEqual(order, [0, 3, 1, 2]);
  assert.deepEqual(
    order.map(i => qfMatches[i].matchNumber),
    ['BU13-Q-M1', 'BU13-Q-M4', 'BU13-Q-M2', 'BU13-Q-M3'],
  );
});
