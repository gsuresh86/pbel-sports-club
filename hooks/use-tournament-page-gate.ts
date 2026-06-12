'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { canAccessTournamentConsole } from '@/lib/permissions';

export function useTournamentPageGate(route: Parameters<ReturnType<typeof usePermissions>['canAccessRoute']>[0]) {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const { canAccessRoute } = usePermissions(tournamentId);

  const queriesEnabled =
    !!user && canAccessTournamentConsole(user, tournamentId) && canAccessRoute(route) && !!tournamentId;

  return { user, tournamentId, queriesEnabled, canAccessRoute };
}
