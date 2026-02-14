/**
 * Central query key factories for TanStack Query.
 * Use these so invalidation and caching stay consistent.
 */
export const queryKeys = {
  tournaments: {
    all: ['tournaments'] as const,
    list: () => [...queryKeys.tournaments.all, 'list'] as const,
    detail: (id: string) => ['tournament', id] as const,
    registrations: (tournamentId: string) =>
      ['tournament', tournamentId, 'registrations'] as const,
    matches: (tournamentId: string) =>
      ['tournament', tournamentId, 'matches'] as const,
    teams: (tournamentId: string) =>
      ['tournament', tournamentId, 'teams'] as const,
    pools: (tournamentId: string) =>
      ['tournament', tournamentId, 'pools'] as const,
  },
};
