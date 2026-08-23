import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUnassignedPoolRegistrations,
  isTeamPoolCategory,
  planManualPoolAssignment,
  type AssignablePool,
} from './poolAssignment.ts';

const pools: AssignablePool[] = [
  {
    id: 'mens-a',
    category: 'mens-single',
    teams: ['assigned-player'],
    maxTeams: 4,
  },
  {
    id: 'womens-a',
    category: 'womens-single',
    teams: [],
    maxTeams: 4,
  },
];

const categoryNormalizations: Record<string, string> = {
  "Men's Singles": 'mens-single',
  "Men's Team": 'mens-team',
};
const normalizeCategory = (category: string) =>
  categoryNormalizations[category] ?? category;

test('finds eligible unassigned registrations for individual pools', () => {
  const registrations = [
    { id: 'available-player', selectedCategory: "Men's Singles", registrationStatus: 'approved' },
    { id: 'assigned-player', selectedCategory: 'mens-single', registrationStatus: 'approved' },
    { id: 'rejected-player', selectedCategory: 'mens-single', registrationStatus: 'rejected' },
    { id: 'team-player', selectedCategory: "Men's Team", registrationStatus: 'approved' },
    { id: 'available-woman', selectedCategory: 'womens-single', registrationStatus: 'pending' },
  ];

  assert.deepEqual(
    getUnassignedPoolRegistrations(
      registrations,
      pools,
      undefined,
      normalizeCategory,
    ).map(registration => registration.id),
    ['available-player', 'available-woman'],
  );
  assert.deepEqual(
    getUnassignedPoolRegistrations(
      registrations,
      pools,
      'mens-single',
      normalizeCategory,
    ).map(registration => registration.id),
    ['available-player'],
  );
});

test('recognizes canonical and display-name team categories', () => {
  assert.equal(isTeamPoolCategory('kids-team-u13'), true);
  assert.equal(isTeamPoolCategory(normalizeCategory("Men's Team")), true);
  assert.equal(isTeamPoolCategory('mixed-doubles'), false);
});

test('moves a member from another same-category pool into the target pool', () => {
  const input: AssignablePool[] = [
    { id: 'a', category: 'mens-single', teams: ['existing'], maxTeams: 3 },
    { id: 'b', category: "Men's Singles", teams: ['moving', 'other'], maxTeams: 3 },
    { id: 'c', category: 'womens-single', teams: ['moving'], maxTeams: 3 },
  ];
  const original = structuredClone(input);

  assert.deepEqual(planManualPoolAssignment(input, 'a', 'moving', normalizeCategory), {
    ok: true,
    updates: [
      { poolId: 'a', memberIds: ['existing', 'moving'] },
      { poolId: 'b', memberIds: ['other'] },
    ],
  });
  assert.deepEqual(input, original);
});

test('rejects an assignment when the target pool is full', () => {
  assert.deepEqual(
    planManualPoolAssignment(
      [{ id: 'a', category: 'mens-single', teams: ['one', 'two'], maxTeams: 2 }],
      'a',
      'three',
    ),
    { ok: false, reason: 'pool-full' },
  );
});

test('treats an existing assignment as a successful no-op', () => {
  assert.deepEqual(
    planManualPoolAssignment(
      [{ id: 'a', category: 'mens-single', teams: [' player '], maxTeams: 2 }],
      'a',
      'player',
    ),
    { ok: true, updates: [] },
  );
});
