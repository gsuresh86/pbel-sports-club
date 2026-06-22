import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNrr,
  computeIndividualPoolStandings,
  computeTeamPoolStandings,
  isPoolPlayComplete,
} from './poolStandings';
import type { Match, Pool, Team } from '@/types';

test('computeNrr returns ratio of points for to against', () => {
  assert.equal(computeNrr(42, 30), 1.4);
  assert.equal(computeNrr(0, 0), 0);
  assert.equal(computeNrr(21, 0), 21);
});

test('computeIndividualPoolStandings ranks by points then game difference then point difference', () => {
  const pool: Pool = {
    id: 'p1', tournamentId: 't1', name: 'Pool A', category: 'mens-single',
    teams: ['a', 'b'], maxTeams: 4, status: 'active', createdAt: new Date(), createdBy: 'u1',
  };
  const matches: Match[] = [
    {
      id: 'm1', tournamentId: 't1', round: 'Pool A', matchNumber: 1,
      player1Id: 'a', player1Name: 'Alice', player2Id: 'b', player2Name: 'Bob',
      player1Score: 2, player2Score: 0, winner: 'Alice', status: 'completed',
      sets: [{ setNumber: 1, player1Score: 21, player2Score: 15 }, { setNumber: 2, player1Score: 21, player2Score: 18 }],
      scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  const rows = computeIndividualPoolStandings(pool, matches, id => id === 'a' ? 'Alice' : 'Bob');
  assert.equal(rows[0].name, 'Alice');
  assert.equal(rows[0].won, 1);
  assert.equal(rows[0].lost, 0);
  assert.equal(rows[0].points, 2);
  assert.equal(rows[0].gamesWon, 2);
  assert.equal(rows[0].gamesLost, 0);
  assert.equal(rows[0].pointsFor, 42);
  assert.equal(rows[0].pointsAgainst, 33);
  assert.equal(rows[0].pointDifference, 9);
  assert.equal(rows[1].lost, 1);
  assert.equal(rows[1].gamesWon, 0);
  assert.equal(rows[1].gamesLost, 2);
});

test('computeTeamPoolStandings uses rubber wins for W/L and set points for NRR', () => {
  const pool: Pool = {
    id: 'p1', tournamentId: 't1', name: 'Pool A', category: 'mens-team',
    teams: ['t1', 't2'], maxTeams: 4, status: 'active', createdAt: new Date(), createdBy: 'u1',
  };
  const teams: Team[] = [
    { id: 't1', tournamentId: 't1', name: 'Team Alpha', category: 'mens-team', players: [], status: 'active', createdAt: new Date(), createdBy: 'u1' },
    { id: 't2', tournamentId: 't1', name: 'Team Beta', category: 'mens-team', players: [], status: 'active', createdAt: new Date(), createdBy: 'u1' },
  ];
  const tie: Match = {
    id: 'tie1', tournamentId: 't1', round: 'Pool A', matchNumber: 1,
    player1Id: 't1', player1Name: 'Team Alpha', player2Id: 't2', player2Name: 'Team Beta',
    matchKind: 'team-tie', rubbersGenerated: true, status: 'live',
    sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
  };
  const rubbers: Match[] = [
    {
      id: 'r1', tournamentId: 't1', round: 'Pool A', matchNumber: 11, parentMatchId: 'tie1',
      matchKind: 'rubber', rubberNumber: 1, rubberType: 'doubles', team1Id: 't1', team2Id: 't2',
      player1Id: 'p1', player1Name: 'A1', player2Id: 'p2', player2Name: 'B1',
      winner: 'A1', status: 'completed',
      sets: [{ setNumber: 1, player1Score: 21, player2Score: 19 }],
      scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'r2', tournamentId: 't1', round: 'Pool A', matchNumber: 12, parentMatchId: 'tie1',
      matchKind: 'rubber', rubberNumber: 2, rubberType: 'single', team1Id: 't1', team2Id: 't2',
      player1Id: 'p3', player1Name: 'A2', player2Id: 'p4', player2Name: 'B2',
      winner: 'A2', status: 'completed',
      sets: [{ setNumber: 1, player1Score: 21, player2Score: 10 }],
      scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'r3', tournamentId: 't1', round: 'Pool A', matchNumber: 13, parentMatchId: 'tie1',
      matchKind: 'rubber', rubberNumber: 3, rubberType: 'doubles', team1Id: 't1', team2Id: 't2',
      player1Id: 'p5', player1Name: 'A3', player2Id: 'p6', player2Name: 'B3',
      winner: 'A3', status: 'completed',
      sets: [{ setNumber: 1, player1Score: 21, player2Score: 18 }],
      scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  const rows = computeTeamPoolStandings(pool, [tie, ...rubbers], teams);
  const alpha = rows.find(r => r.id === 't1')!;
  const beta = rows.find(r => r.id === 't2')!;
  assert.equal(alpha.won, 1);
  assert.equal(beta.lost, 1);
  assert.equal(alpha.points, 2);
  assert.equal(alpha.gamesWon, 3);
  assert.equal(alpha.gamesLost, 0);
  assert.equal(alpha.pointsFor, 63);
  assert.equal(alpha.pointsAgainst, 47);
  assert.equal(alpha.pointDifference, 16);
});

test('isPoolPlayComplete is false until all individual pool matches are completed', () => {
  const pool: Pool = {
    id: 'p1', tournamentId: 't1', name: 'Pool A', category: 'mens-single',
    teams: ['a', 'b', 'c'], maxTeams: 4, status: 'active', createdAt: new Date(), createdBy: 'u1',
  };
  const base = {
    tournamentId: 't1', round: 'Pool A', scheduledTime: new Date(), venue: 'Court',
    updatedAt: new Date(), createdBy: 'u1', sets: [],
  };
  const incomplete: Match[] = [
    { id: 'm1', ...base, matchNumber: 1, player1Id: 'a', player1Name: 'A', player2Id: 'b', player2Name: 'B', status: 'completed', player1Score: 2, player2Score: 0, winner: 'A' },
    { id: 'm2', ...base, matchNumber: 2, player1Id: 'a', player1Name: 'A', player2Id: 'c', player2Name: 'C', status: 'scheduled' },
    { id: 'm3', ...base, matchNumber: 3, player1Id: 'b', player1Name: 'B', player2Id: 'c', player2Name: 'C', status: 'scheduled' },
  ];
  assert.equal(isPoolPlayComplete(pool, incomplete, { isTeamCat: false }), false);

  const complete: Match[] = incomplete.map(m => ({ ...m, status: 'completed' as const, player1Score: 2, player2Score: 0, winner: m.player1Name }));
  assert.equal(isPoolPlayComplete(pool, complete, { isTeamCat: false }), true);
});

test('isPoolPlayComplete resolves team ties from rubbers', () => {
  const pool: Pool = {
    id: 'p1', tournamentId: 't1', name: 'Pool A', category: 'mens-team',
    teams: ['t1', 't2'], maxTeams: 4, status: 'active', createdAt: new Date(), createdBy: 'u1',
  };
  const teams: Team[] = [
    { id: 't1', tournamentId: 't1', name: 'Alpha', category: 'mens-team', players: [], status: 'active', createdAt: new Date(), createdBy: 'u1' },
    { id: 't2', tournamentId: 't1', name: 'Beta', category: 'mens-team', players: [], status: 'active', createdAt: new Date(), createdBy: 'u1' },
  ];
  const tie: Match = {
    id: 'tie1', tournamentId: 't1', round: 'Pool A', matchNumber: 1,
    player1Id: 't1', player1Name: 'Alpha', player2Id: 't2', player2Name: 'Beta',
    matchKind: 'team-tie', rubbersGenerated: true, status: 'live',
    sets: [], scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
  };
  const rubbers: Match[] = [
    {
      id: 'r1', tournamentId: 't1', round: 'Pool A', matchNumber: 11, parentMatchId: 'tie1',
      matchKind: 'rubber', rubberNumber: 1, rubberType: 'doubles', team1Id: 't1', team2Id: 't2',
      player1Id: 'p1', player1Name: 'A1', player2Id: 'p2', player2Name: 'B1',
      winner: 'A1', status: 'completed',
      sets: [{ setNumber: 1, player1Score: 21, player2Score: 19 }],
      scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'r2', tournamentId: 't1', round: 'Pool A', matchNumber: 12, parentMatchId: 'tie1',
      matchKind: 'rubber', rubberNumber: 2, rubberType: 'single', team1Id: 't1', team2Id: 't2',
      player1Id: 'p3', player1Name: 'A2', player2Id: 'p4', player2Name: 'B2',
      winner: 'A2', status: 'completed',
      sets: [{ setNumber: 1, player1Score: 21, player2Score: 10 }],
      scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
    {
      id: 'r3', tournamentId: 't1', round: 'Pool A', matchNumber: 13, parentMatchId: 'tie1',
      matchKind: 'rubber', rubberNumber: 3, rubberType: 'doubles', team1Id: 't1', team2Id: 't2',
      player1Id: 'p5', player1Name: 'A3', player2Id: 'p6', player2Name: 'B3',
      winner: 'A3', status: 'completed',
      sets: [{ setNumber: 1, player1Score: 21, player2Score: 18 }],
      scheduledTime: new Date(), venue: 'Court', updatedAt: new Date(), createdBy: 'u1',
    },
  ];
  assert.equal(isPoolPlayComplete(pool, [tie, ...rubbers], { isTeamCat: true, teams }), true);
});
