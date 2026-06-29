export type TournamentPublicTab =
  | 'overview'
  | 'matches'
  | 'results'
  | 'teams'
  | 'pools'
  | 'knockout';

export const TOURNAMENT_TAB_SLUGS: Record<TournamentPublicTab, string | null> = {
  overview: null,
  matches: 'fixtures',
  results: 'results',
  pools: 'points',
  knockout: 'knockout',
  teams: 'teams',
};

const SLUG_TO_TAB = Object.fromEntries(
  Object.entries(TOURNAMENT_TAB_SLUGS)
    .filter(([, slug]) => slug != null)
    .map(([tab, slug]) => [slug, tab]),
) as Record<string, TournamentPublicTab>;

export function tournamentTabPath(tournamentId: string, tab: TournamentPublicTab): string {
  const slug = TOURNAMENT_TAB_SLUGS[tab];
  return slug ? `/tournament/${tournamentId}/${slug}` : `/tournament/${tournamentId}`;
}

export function tournamentTabFromSlug(slug: string): TournamentPublicTab | null {
  return SLUG_TO_TAB[slug] ?? null;
}
