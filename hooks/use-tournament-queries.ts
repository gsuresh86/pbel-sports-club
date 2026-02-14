'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchTournament,
  fetchTournamentRegistrations,
  fetchTournamentMatches,
  fetchTournamentTeams,
  fetchTournamentPools,
  updateTournament,
  type TournamentUpdatePayload,
} from '@/lib/tournament-api';

export function useTournament(tournamentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.detail(tournamentId ?? ''),
    queryFn: () => fetchTournament(tournamentId!),
    enabled: !!tournamentId && (options?.enabled !== false),
  });
}

export function useTournamentRegistrations(tournamentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.registrations(tournamentId ?? ''),
    queryFn: () => fetchTournamentRegistrations(tournamentId!),
    enabled: !!tournamentId && (options?.enabled !== false),
  });
}

export function useTournamentMatches(tournamentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.matches(tournamentId ?? ''),
    queryFn: () => fetchTournamentMatches(tournamentId!),
    enabled: !!tournamentId && (options?.enabled !== false),
  });
}

export function useTournamentTeams(tournamentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.teams(tournamentId ?? ''),
    queryFn: () => fetchTournamentTeams(tournamentId!),
    enabled: !!tournamentId && (options?.enabled !== false),
  });
}

export function useTournamentPools(tournamentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.pools(tournamentId ?? ''),
    queryFn: () => fetchTournamentPools(tournamentId!),
    enabled: !!tournamentId && (options?.enabled !== false),
  });
}

/** Invalidate all tournament-related queries for a given tournament (e.g. after team/pool/match update). */
export function useInvalidateTournament() {
  const queryClient = useQueryClient();
  return (tournamentId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(tournamentId) });
}

export function useUpdateTournamentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId, data }: { tournamentId: string; data: TournamentUpdatePayload }) =>
      updateTournament(tournamentId, data),
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(tournamentId) });
    },
  });
}
