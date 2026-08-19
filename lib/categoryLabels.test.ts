import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalPublicPlayerId,
  categoriesMatch,
  collectPublicCategorySlugs,
  countPublicCategoryPeople,
  countPublicListedPlayers,
  isDoublesCategory,
  normalizeCategorySlug,
  playerHeadcount,
  uniqueCategoryPlayers,
} from './categoryLabels.ts';

test('normalizeCategorySlug maps labels and common variants', () => {
  assert.equal(normalizeCategorySlug('boys-under-13'), 'boys-under-13');
  assert.equal(normalizeCategorySlug('Boys Under 13'), 'boys-under-13');
  assert.equal(normalizeCategorySlug("Boy's Under 13"), 'boys-under-13');
  assert.equal(normalizeCategorySlug('Boys U13'), 'boys-under-13');
  assert.equal(normalizeCategorySlug('mens-singles'), 'mens-single');
  assert.equal(normalizeCategorySlug("Men's Singles"), 'mens-single');
  assert.equal(normalizeCategorySlug('Mens Singles'), 'mens-single');
  assert.equal(normalizeCategorySlug('Mixed Doubles'), 'mixed-doubles');
  assert.equal(normalizeCategorySlug('kids-team-u13'), 'kids-team-u13');
  assert.equal(normalizeCategorySlug('Kids Team U13'), 'kids-team-u13');
});

test('normalizeCategorySlug keeps unknown values trimmed', () => {
  assert.equal(normalizeCategorySlug(' custom-cat '), 'custom-cat');
  assert.equal(normalizeCategorySlug(''), undefined);
  assert.equal(normalizeCategorySlug(null), undefined);
});

test('categoriesMatch ignores formatting differences', () => {
  assert.equal(categoriesMatch('boys-under-13', 'Boys Under 13'), true);
  assert.equal(categoriesMatch('mens-single', 'mens-singles'), true);
  assert.equal(categoriesMatch('mens-single', 'mens-doubles'), false);
});

test('isDoublesCategory uses canonical slugs', () => {
  assert.equal(isDoublesCategory('mixed-doubles'), true);
  assert.equal(isDoublesCategory('Mixed Doubles'), true);
  assert.equal(isDoublesCategory('mens-team'), false);
});

test('playerHeadcount includes doubles partners', () => {
  assert.equal(playerHeadcount({}), 1);
  assert.equal(playerHeadcount({ partnerName: '  ' }), 1);
  assert.equal(playerHeadcount({ partnerName: 'Alex' }), 2);
});

test('countPublicListedPlayers matches public category counts', () => {
  const regs = [
    { selectedCategory: 'mens-single', registrationStatus: 'approved' as const },
    { selectedCategory: "Men's Singles", registrationStatus: 'pending' as const },
    { selectedCategory: 'mens-single', registrationStatus: 'rejected' as const },
    { selectedCategory: 'mens-doubles', registrationStatus: 'approved' as const, partnerName: 'Pat' },
    { selectedCategory: 'mens-doubles', registrationStatus: 'pending' as const },
  ];
  assert.equal(countPublicListedPlayers(regs, 'mens-single'), 2);
  assert.equal(countPublicListedPlayers(regs, "Men's Doubles"), 3);
  assert.equal(countPublicListedPlayers(regs), 5);
});

test('collectPublicCategorySlugs unions and dedupes', () => {
  assert.deepEqual(
    collectPublicCategorySlugs(
      ['mens-single', 'boys-under-13'],
      ["Men's Singles", 'Kids Team U13'],
    ),
    ['mens-single', 'boys-under-13', 'kids-team-u13'],
  );
});

test('uniqueCategoryPlayers includes roster members from other categories', () => {
  const players = [
    { id: 'a', selectedCategory: 'mens-team' },
    { id: 'b', selectedCategory: 'mens-single' },
  ];
  const listed = uniqueCategoryPlayers('mens-team', players, ['b']);
  assert.deepEqual(listed.map((p) => p.id), ['a', 'b']);
});

test('uniqueCategoryPlayers resolves registration-primary pool ids', () => {
  const players = [{ id: 'reg1', name: 'Aarav', selectedCategory: 'boys-under-13' }];
  const listed = uniqueCategoryPlayers('boys-under-13', players, ['reg1-primary']);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, 'reg1');
});

test('countPublicCategoryPeople includes assigned slots missing from publicPlayers', () => {
  const listed = [
    { id: 'a', name: 'Aarav' },
    { id: 'b', name: 'Vihaan' },
  ];
  assert.equal(canonicalPublicPlayerId('abc-primary'), 'abc');
  assert.equal(countPublicCategoryPeople(listed, ['a', 'b', 'missing-1', 'missing-2']), 4);
});

test('countPublicCategoryPeople does not collapse two players with the same name', () => {
  const listed = [
    { id: 'a', name: 'Rahul Sharma' },
    { id: 'b', name: 'Rahul Sharma' },
  ];
  assert.equal(countPublicCategoryPeople(listed, []), 2);
});
