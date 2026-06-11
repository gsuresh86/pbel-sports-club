'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchTournament,
  fetchTournaments,
  fetchTournamentRegistrations,
  fetchTournamentMatches,
  fetchTournamentTeams,
  fetchTournamentPools,
  updateTournament,
  cloneTournament,
  deleteTournament,
  type TournamentUpdatePayload,
} from '@/lib/tournament-api';

export function useTournaments(options?: { assignedIds?: string[]; enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.list(),
    queryFn: () => fetchTournaments(options?.assignedIds),
    enabled: options?.enabled !== false,
  });
}

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
    staleTime: 0,
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

/** Invalidate tournament queries (detail, matches, teams, pools, registrations). */
export function useInvalidateTournament() {
  const queryClient = useQueryClient();
  return (tournamentId: string) => {
    queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
  };
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

export function useCloneTournamentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceTournamentId,
      createdBy,
      newName,
    }: {
      sourceTournamentId: string;
      createdBy: string;
      newName?: string;
    }) => cloneTournament(sourceTournamentId, createdBy, { newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.list() });
    },
  });
}

export function useDeleteTournamentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tournamentId: string) => deleteTournament(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.list() });
    },
  });
}
