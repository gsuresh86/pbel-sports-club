import type { CategoryType } from '@/types';

export const CATEGORY_LABELS: Record<string, string> = {
  'girls-under-13': 'Girls U13',
  'boys-under-13': 'Boys U13',
  'girls-under-18': 'Girls U18',
  'boys-under-18': 'Boys U18',
  'mens-single': "Men's Singles",
  'womens-single': "Women's Singles",
  'mens-doubles': "Men's Doubles",
  'womens-doubles': "Women's Doubles",
  'mixed-doubles': 'Mixed Doubles',
  'family-doubles': 'Family Doubles',
  'mens-team': "Men's Team",
  'womens-team': "Women's Team",
  'kids-team-u13': 'Kids Team U13',
  'kids-team-u18': 'Kids Team U18',
  'open-team': 'Open Team',
};

const CATEGORY_ALIASES: Record<string, string> = {};

function aliasKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[''`´’]/g, '')
    .replace(/[_/]+/g, '-')
    .replace(/[().,]/g, ' ')
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function addAlias(alias: string, slug: string) {
  const keys = [aliasKey(alias), aliasKey(alias.replace(/-/g, ' ')), aliasKey(alias.replace(/\s+/g, '-'))];
  for (const key of keys) {
    if (!key) continue;
    CATEGORY_ALIASES[key] = slug;
    CATEGORY_ALIASES[key.replace(/\s+/g, '-')] = slug;
    CATEGORY_ALIASES[key.replace(/-/g, ' ')] = slug;
  }
}

for (const slug of Object.keys(CATEGORY_LABELS)) {
  addAlias(slug, slug);
  addAlias(CATEGORY_LABELS[slug], slug);
  if (slug.endsWith('-single')) {
    addAlias(`${slug}s`, slug);
  }
  if (slug.includes('-under-')) {
    addAlias(slug.replace('-under-', '-u-'), slug);
    addAlias(slug.replace('-under-', '-u'), slug);
    addAlias(slug.replace('-under-', ' u '), slug);
  }
}

/** Map labels / spaced names ("Boys Under 13") to the canonical category slug. */
export function normalizeCategorySlug(value: string | undefined | null): CategoryType | undefined {
  if (!value) return undefined;
  const key = aliasKey(value);
  const fromAlias =
    CATEGORY_ALIASES[key] ??
    CATEGORY_ALIASES[key.replace(/\s+/g, '-')] ??
    CATEGORY_ALIASES[key.replace(/-/g, ' ')];
  if (fromAlias) return fromAlias as CategoryType;
  const trimmed = value.trim();
  return trimmed ? (trimmed as CategoryType) : undefined;
}

export function categoriesMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  const left = normalizeCategorySlug(a);
  const right = normalizeCategorySlug(b);
  return !!left && left === right;
}

export function formatCategoryLabel(cat: string): string {
  const slug = normalizeCategorySlug(cat) ?? cat;
  return CATEGORY_LABELS[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function isDoublesCategory(cat: string | undefined | null): boolean {
  const slug = (normalizeCategorySlug(cat) ?? cat ?? '').toLowerCase();
  return slug.includes('doubles');
}

/** Pending and approved registrations appear on the public category lists. */
export function isListedOnPublic(reg: { registrationStatus?: string }): boolean {
  return reg.registrationStatus !== 'rejected';
}

/** One registration is one person, or two when a doubles partner is named. */
export function playerHeadcount(reg: { partnerName?: string | null }): number {
  return 1 + (reg.partnerName?.trim() ? 1 : 0);
}

export function countPublicListedPlayers(
  regs: Array<{
    partnerName?: string | null;
    registrationStatus?: string;
    selectedCategory?: string;
  }>,
  category?: string,
): number {
  return regs.reduce((n, r) => {
    if (!isListedOnPublic(r)) return n;
    if (category && !categoriesMatch(r.selectedCategory, category)) return n;
    return n + playerHeadcount(r);
  }, 0);
}

/** Dedupe category values onto canonical slugs, keeping tournament order first. */
export function collectPublicCategorySlugs(
  ...groups: Array<Iterable<string | undefined | null> | undefined>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const raw of group) {
      const slug = normalizeCategorySlug(raw);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push(slug);
    }
  }
  return out;
}

/** Pool/team assignment ids sometimes use `{registrationId}-primary`. */
export function canonicalPublicPlayerId(id: string): string {
  return id.replace(/-(primary|partner)$/i, '');
}

export function categoryAssignmentIds(
  category: string,
  teams: Array<{ category?: string; players?: string[] }>,
  pools: Array<{ category?: string; teams?: string[] }>,
): string[] {
  const ids: string[] = [];
  for (const team of teams) {
    if (categoriesMatch(team.category, category)) ids.push(...(team.players ?? []));
  }
  for (const pool of pools) {
    if (categoriesMatch(pool.category, category)) ids.push(...(pool.teams ?? []));
  }
  return ids;
}

function findParticipant<T extends { id: string }>(byId: Map<string, T>, id: string): T | undefined {
  return byId.get(id) ?? byId.get(canonicalPublicPlayerId(id));
}

/** Players listed in a category, plus anyone assigned to that category's teams/pools. */
export function uniqueCategoryPlayers<T extends { id: string; selectedCategory?: string }>(
  category: string,
  participants: T[],
  extraIds: Iterable<string> = [],
): T[] {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const out: T[] = [];
  const seen = new Set<string>();
  const add = (player?: T) => {
    if (!player || seen.has(player.id)) return;
    seen.add(player.id);
    out.push(player);
  };
  participants.filter((p) => categoriesMatch(p.selectedCategory, category)).forEach(add);
  for (const id of extraIds) add(findParticipant(byId, id));
  return out;
}

/** One entry per registration (partners included), plus assigned slots with no public copy. */
export function countPublicCategoryPeople<T extends { id: string; partnerName?: string | null }>(
  listed: T[],
  extraIds: Iterable<string> = [],
): number {
  const listedIds = new Set<string>();
  for (const player of listed) {
    listedIds.add(player.id);
    listedIds.add(canonicalPublicPlayerId(player.id));
  }
  let missingAssigned = 0;
  const seenExtra = new Set<string>();
  for (const id of extraIds) {
    if (!id || seenExtra.has(id) || listedIds.has(id) || listedIds.has(canonicalPublicPlayerId(id))) continue;
    seenExtra.add(id);
    missingAssigned += 1;
  }
  return listed.reduce((n, player) => n + playerHeadcount(player), 0) + missingAssigned;
}
