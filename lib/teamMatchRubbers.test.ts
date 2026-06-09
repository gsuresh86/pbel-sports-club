import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_RUBBER_SEQUENCE,
  validateRubberLineup,
  type RubberLineupSlot,
} from './teamMatchRubbers';

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

test('validateRubberLineup rejects incomplete doubles lineup', () => {
  const lineup: RubberLineupSlot[] = TEAM_RUBBER_SEQUENCE.map(r => ({
    rubberNumber: r.rubberNumber,
    rubberType: r.rubberType,
    team1PlayerIds: r.rubberNumber === 1 ? ['a1'] : (r.rubberType === 'doubles' ? ['a1', 'a2'] : ['a1']),
    team2PlayerIds: r.rubberType === 'doubles' ? ['b1', 'b2'] : ['b1'],
  }));
  assert.match(validateRubberLineup(lineup) ?? '', /Rubber 1/);
});
