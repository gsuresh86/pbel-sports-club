'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchTournamentFinances,
  addFinanceEntry,
  updateFinanceEntry,
  deleteFinanceEntry,
  type FinanceEntryInput,
} from '@/lib/finance-api';

export function useTournamentFinances(
  tournamentId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.tournaments.finances(tournamentId ?? ''),
    queryFn: () => fetchTournamentFinances(tournamentId!),
    enabled: !!tournamentId && options?.enabled !== false,
  });
}

export function useAddFinanceEntry(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, createdBy }: { input: FinanceEntryInput; createdBy?: string }) =>
      addFinanceEntry(tournamentId, input, createdBy),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.tournaments.finances(tournamentId),
      }),
  });
}

export function useUpdateFinanceEntry(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, input }: { entryId: string; input: FinanceEntryInput }) =>
      updateFinanceEntry(tournamentId, entryId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.tournaments.finances(tournamentId),
      }),
  });
}

export function useDeleteFinanceEntry(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => deleteFinanceEntry(tournamentId, entryId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.tournaments.finances(tournamentId),
      }),
  });
}
