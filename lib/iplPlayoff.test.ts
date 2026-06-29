import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPoolTopFour,
  previewIplPlayoffRound,
  normalizeIplPlayoffRound,
  findIplRoundMatch,
} from './iplPlayoff';
import type { Match, Pool } from '@/types';

const pool: Pool = {
  id: 'p1',
  tournamentId: 't1',
  name: 'League',
  category: 'mens-single',
  teams: ['a', 'b', 'c', 'd', 'e'],
  maxTeams: 8,
  status: 'active',
  createdAt: new Date(),
  createdBy: 'u1',
};

const registrations = [
  { id: 'a', name: 'Team A' },
  { id: 'b', name: 'Team B' },
  { id: 'c', name: 'Team C' },
  { id: 'd', name: 'Team D' },
  { id: 'e', name: 'Team E' },
] as any[];

function poolMatch(
  id: string,
  p1: string,
  p2: string,
  winner: string,
  p1Score: number,
  p2Score: number,
): Match {
  const name = (pid: string) => registrations.find(r => r.id === pid)!.name;
  return {
    id,
    tournamentId: 't1',
    round: pool.name,
    matchNumber: 1,
    player1Id: p1,
    player1Name: name(p1),
    player2Id: p2,
    player2Name: name(p2),
    player1Score: p1Score,
    player2Score: p2Score,
    winner: name(winner),
    status: 'completed',
    sets: [],
    scheduledTime: new Date(),
    venue: 'Court',
    updatedAt: new Date(),
    createdBy: 'u1',
  };
}

test('normalizeIplPlayoffRound maps legacy codes', () => {
  assert.equal(normalizeIplPlayoffRound('Q1'), 'Qualifier1');
  assert.equal(normalizeIplPlayoffRound('E'), 'Eliminator');
  assert.equal(normalizeIplPlayoffRound('Q2'), 'Qualifier2');
  assert.equal(normalizeIplPlayoffRound('Qualifier1'), 'Qualifier1');
  assert.equal(normalizeIplPlayoffRound('SF'), null);
});

test('findIplRoundMatch accepts legacy stored round values', () => {
  const matches: Match[] = [
    {
      id: 'q1', tournamentId: 't1', round: 'Q1', category: 'mens-single', matchNumber: 'Q1',
      player1Id: 'a', player1Name: 'Team A', player2Id: 'b', player2Name: 'Team B',
      status: 'scheduled', sets: [], scheduledTime: new Date(), venue: 'Court',
      updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  assert.equal(findIplRoundMatch(matches, 'Qualifier1')?.id, 'q1');
});

test('getPoolTopFour returns top 4 by pool standings', () => {
  const matches: Match[] = [
    poolMatch('m1', 'a', 'b', 'a', 2, 0),
    poolMatch('m2', 'a', 'c', 'a', 2, 1),
    poolMatch('m3', 'a', 'd', 'a', 2, 0),
    poolMatch('m4', 'b', 'c', 'b', 2, 1),
    poolMatch('m5', 'b', 'd', 'b', 2, 0),
    poolMatch('m6', 'c', 'd', 'c', 2, 1),
    poolMatch('m7', 'e', 'a', 'a', 2, 0),
  ];
  const top = getPoolTopFour(pool, matches, { isTeamCat: false, registrations });
  assert.equal(top.length, 4);
  assert.equal(top[0].id, 'a');
  assert.equal(top[0].poolRank, 1);
});

test('previewIplPlayoffRound Qualifier1 pairs 1st vs 2nd', () => {
  const matches: Match[] = [
    poolMatch('m1', 'a', 'b', 'a', 2, 0),
    poolMatch('m2', 'a', 'c', 'a', 2, 1),
    poolMatch('m3', 'b', 'c', 'b', 2, 1),
    poolMatch('m4', 'a', 'd', 'a', 2, 0),
    poolMatch('m5', 'b', 'd', 'b', 2, 0),
    poolMatch('m6', 'c', 'd', 'c', 2, 1),
  ];
  const preview = previewIplPlayoffRound('Qualifier1', 'mens-single', pool, matches, {
    teams: [],
    registrations,
  });
  assert.equal(preview.pairings.length, 1);
  assert.deepEqual(
    [preview.pairings[0].player1.poolRank, preview.pairings[0].player2.poolRank],
    [1, 2],
  );
});

test('previewIplPlayoffRound Eliminator pairs 3rd vs 4th', () => {
  const matches: Match[] = [
    poolMatch('m1', 'a', 'b', 'a', 2, 0),
    poolMatch('m2', 'a', 'c', 'a', 2, 1),
    poolMatch('m3', 'b', 'c', 'b', 2, 1),
    poolMatch('m4', 'a', 'd', 'a', 2, 0),
    poolMatch('m5', 'b', 'd', 'b', 2, 0),
    poolMatch('m6', 'c', 'd', 'c', 2, 1),
  ];
  const preview = previewIplPlayoffRound('Eliminator', 'mens-single', pool, matches, {
    teams: [],
    registrations,
  });
  assert.equal(preview.pairings.length, 1);
  assert.deepEqual(
    [preview.pairings[0].player1.poolRank, preview.pairings[0].player2.poolRank],
    [3, 4],
  );
});

test('previewIplPlayoffRound Qualifier2 pairs loser Qualifier1 vs winner Eliminator', () => {
  const matches: Match[] = [
    {
      id: 'q1', tournamentId: 't1', round: 'Qualifier1', category: 'mens-single', matchNumber: 'Qualifier1',
      player1Id: 'a', player1Name: 'Team A', player2Id: 'b', player2Name: 'Team B',
      player1Score: 2, player2Score: 1, winner: 'Team A', status: 'completed',
      sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'e1', tournamentId: 't1', round: 'Eliminator', category: 'mens-single', matchNumber: 'Eliminator',
      player1Id: 'c', player1Name: 'Team C', player2Id: 'd', player2Name: 'Team D',
      player1Score: 2, player2Score: 0, winner: 'Team C', status: 'completed',
      sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  const preview = previewIplPlayoffRound('Qualifier2', 'mens-single', pool, matches, {
    teams: [],
    registrations,
  });
  assert.equal(preview.pairings.length, 1);
  assert.deepEqual(
    [preview.pairings[0].player1.name, preview.pairings[0].player2.name],
    ['Team B', 'Team C'],
  );
});

test('previewIplPlayoffRound F pairs winner Qualifier1 vs winner Qualifier2', () => {
  const matches: Match[] = [
    {
      id: 'q1', tournamentId: 't1', round: 'Qualifier1', category: 'mens-single', matchNumber: 'Qualifier1',
      player1Id: 'a', player1Name: 'Team A', player2Id: 'b', player2Name: 'Team B',
      player1Score: 2, player2Score: 0, winner: 'Team A', status: 'completed',
      sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'q2', tournamentId: 't1', round: 'Qualifier2', category: 'mens-single', matchNumber: 'Qualifier2',
      player1Id: 'b', player1Name: 'Team B', player2Id: 'c', player2Name: 'Team C',
      player1Score: 2, player2Score: 1, winner: 'Team C', status: 'completed',
      sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  const preview = previewIplPlayoffRound('F', 'mens-single', pool, matches, {
    teams: [],
    registrations,
  });
  assert.equal(preview.pairings.length, 1);
  assert.deepEqual(
    [preview.pairings[0].player1.name, preview.pairings[0].player2.name],
    ['Team A', 'Team C'],
  );
});

test('previewIplPlayoffRound Qualifier2 works with legacy round codes on prior matches', () => {
  const matches: Match[] = [
    {
      id: 'q1', tournamentId: 't1', round: 'Q1', category: 'mens-single', matchNumber: 'Q1',
      player1Id: 'a', player1Name: 'Team A', player2Id: 'b', player2Name: 'Team B',
      player1Score: 2, player2Score: 1, winner: 'Team A', status: 'completed',
      sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'e1', tournamentId: 't1', round: 'E', category: 'mens-single', matchNumber: 'E',
      player1Id: 'c', player1Name: 'Team C', player2Id: 'd', player2Name: 'Team D',
      player1Score: 2, player2Score: 0, winner: 'Team C', status: 'completed',
      sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  const preview = previewIplPlayoffRound('Qualifier2', 'mens-single', pool, matches, {
    teams: [],
    registrations,
  });
  assert.equal(preview.pairings.length, 1);
  assert.deepEqual(
    [preview.pairings[0].player1.name, preview.pairings[0].player2.name],
    ['Team B', 'Team C'],
  );
});
