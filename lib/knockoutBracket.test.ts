import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCrossPoolQFPairings,
  buildQFPairings,
  buildSeededBracketPairings,
  getQualifyCount,
  previewKnockoutRound,
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
