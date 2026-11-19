import test from 'node:test';
import assert from 'node:assert/strict';
import type { Match } from '@/types';
import { buildCategoryPodiums } from './categoryPodium.ts';

function match(partial: Partial<Match> & Pick<Match, 'id' | 'round' | 'category'>): Match {
  return {
    tournamentId: 't1',
    matchNumber: partial.id,
    player1Id: 'p1',
    player1Name: 'Player One',
    player2Id: 'p2',
    player2Name: 'Player Two',
    status: 'scheduled',
    sets: [],
    scheduledTime: new Date('2026-01-01T10:00:00Z'),
    venue: 'Court',
    updatedAt: new Date(),
    createdBy: 'u1',
    ...partial,
  };
}

test('buildCategoryPodiums reads winner and runner-up from the final', () => {
  const podiums = buildCategoryPodiums(
    ['mens-single', 'womens-single'],
    [
      match({
        id: 'sf',
        round: 'MS SF',
        knockoutType: 'SF',
        category: 'mens-single',
        status: 'completed',
        winner: 'Player One',
        player1Score: 2,
        player2Score: 0,
      }),
      match({
        id: 'f',
        round: 'MS Final',
        knockoutType: 'F',
        category: 'mens-single',
        status: 'completed',
        winner: 'Player Two',
        player1Score: 1,
        player2Score: 2,
        player1Name: 'Arun',
        player1Id: 'arun',
        player2Name: 'Kiran',
        player2Id: 'kiran',
      }),
      match({
        id: 'tp',
        round: 'MS Third',
        knockoutType: 'TP',
        category: 'mens-single',
        status: 'completed',
        winner: 'Dev',
        player1Name: 'Dev',
        player1Id: 'dev',
        player2Name: 'Ravi',
        player2Id: 'ravi',
        player1Score: 2,
        player2Score: 1,
      }),
    ],
  );

  const mens = podiums.find((podium) => podium.category === 'mens-single');
  assert.ok(mens);
  assert.equal(mens.winner?.name, 'Kiran');
  assert.equal(mens.runnerUp?.name, 'Arun');
  assert.equal(mens.third?.name, 'Dev');
  assert.equal(mens.finalScore, '2–1');

  const womens = podiums.find((podium) => podium.category === 'womens-single');
  assert.ok(womens);
  assert.equal(womens.winner, null);
  assert.equal(womens.runnerUp, null);
});

test('buildCategoryPodiums keeps doubles partners and ignores an unfinished final', () => {
  const podiums = buildCategoryPodiums(
    ['mixed-doubles'],
    [
      match({
        id: 'md-f',
        round: 'Final',
        category: 'mixed-doubles',
        status: 'completed',
        winner: 'Asha',
        player1Name: 'Asha',
        player1Id: 'asha',
        player1PartnerName: 'Ravi',
        player2Name: 'Meera',
        player2Id: 'meera',
        player2PartnerName: 'Nikhil',
        player1Score: 2,
        player2Score: 0,
      }),
      match({
        id: 'ws-f',
        round: 'F',
        category: 'womens-single',
        status: 'scheduled',
        player1Name: 'Leela',
        player2Name: 'Nisha',
      }),
    ],
  );

  const mixed = podiums.find((podium) => podium.category === 'mixed-doubles');
  assert.equal(mixed?.winner?.name, 'Asha');
  assert.equal(mixed?.winner?.partnerName, 'Ravi');
  assert.equal(mixed?.runnerUp?.name, 'Meera');
  assert.equal(mixed?.runnerUp?.partnerName, 'Nikhil');

  const womens = podiums.find((podium) => podium.category === 'womens-single');
  assert.equal(womens?.winner, null);
  assert.equal(womens?.runnerUp, null);
});

test('buildCategoryPodiums does not copy an uncategorized final onto every category', () => {
  const podiums = buildCategoryPodiums(
    ['mens-single', 'womens-single'],
    [
      match({
        id: 'bare-final',
        round: 'F',
        category: undefined,
        status: 'completed',
        winner: 'Player One',
        player1Score: 2,
        player2Score: 0,
      }),
    ],
  );

  assert.equal(podiums.every((podium) => podium.winner == null), true);
});
