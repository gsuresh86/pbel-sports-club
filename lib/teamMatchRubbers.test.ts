import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_RUBBER_SEQUENCE,
  validateRubberLineup,
  lineupFromRubbers,
  type RubberLineupSlot,
} from './teamMatchRubbers';
import type { Match } from '@/types';

test('TEAM_RUBBER_SEQUENCE has 5 rubbers in doubles-single-doubles-single-doubles order', () => {
  assert.equal(TEAM_RUBBER_SEQUENCE.length, 5);
  assert.deepEqual(
    TEAM_RUBBER_SEQUENCE.map(r => r.rubberType),
    ['doubles', 'single', 'doubles', 'single', 'doubles'],
  );
});

test('validateRubberLineup accepts a complete valid lineup', () => {
  const lineup: RubberLineupSlot[] = TEAM_RUBBER_SEQUENCE.map(r => ({
    rubberNumber: r.rubberNumber,
    rubberType: r.rubberType,
    team1PlayerIds: r.rubberType === 'doubles' ? ['a1', 'a2'] : ['a1'],
    team2PlayerIds: r.rubberType === 'doubles' ? ['b1', 'b2'] : ['b1'],
  }));
  assert.equal(validateRubberLineup(lineup), null);
});

test('lineupFromRubbers rebuilds doubles and singles slots', () => {
  const rubbers = [
    {
      id: 'r1',
      rubberNumber: 1,
      rubberType: 'doubles',
      player1Id: 'a1',
      player1PartnerId: 'a2',
      player2Id: 'b1',
      player2PartnerId: 'b2',
    },
    {
      id: 'r2',
      rubberNumber: 2,
      rubberType: 'single',
      player1Id: 'a3',
      player2Id: 'b3',
    },
  ] as Match[];

  const lineup = lineupFromRubbers(rubbers);
  assert.equal(lineup.length, 2);
  assert.deepEqual(lineup[0].team1PlayerIds, ['a1', 'a2']);
  assert.deepEqual(lineup[0].team2PlayerIds, ['b1', 'b2']);
  assert.deepEqual(lineup[1].team1PlayerIds, ['a3']);
  assert.deepEqual(lineup[1].team2PlayerIds, ['b3']);
});

test('validateRubberLineup rejects incomplete doubles lineup', () => {
  const lineup: RubberLineupSlot[] = TEAM_RUBBER_SEQUENCE.map(r => ({
    rubberNumber: r.rubberNumber,
    rubberType: r.rubberType,
    team1PlayerIds: r.rubberNumber === 1 ? ['a1'] : (r.rubberType === 'doubles' ? ['a1', 'a2'] : ['a1']),
    team2PlayerIds: r.rubberType === 'doubles' ? ['b1', 'b2'] : ['b1'],
  }));
  assert.match(validateRubberLineup(lineup) ?? '', /Rubber 1/);
});
