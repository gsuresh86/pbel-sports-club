'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Permission,
  TournamentRoute,
  canAccessTournamentConsole,
  canAccessTournamentRoute,
  canManageTournamentUsers,
  canWriteMatches,
  getAllowedNavItems,
  hasPermission,
  resolvePermissions,
} from '@/lib/permissions';

export function usePermissions(tournamentId?: string) {
  const { user } = useAuth();

  return useMemo(
    () => ({
      user,
      permissions: resolvePermissions(user, tournamentId),
      hasPermission: (permission: Permission) => hasPermission(user, permission, tournamentId),
      canAccessRoute: (route: TournamentRoute) =>
        canAccessTournamentRoute(user, route, tournamentId),
      canAccessConsole: () => canAccessTournamentConsole(user, tournamentId),
      canWriteMatches: () => (tournamentId ? canWriteMatches(user, tournamentId) : false),
      canManageUsers: () => (tournamentId ? canManageTournamentUsers(user, tournamentId) : false),
      allowedNavItems: tournamentId ? getAllowedNavItems(user, tournamentId) : [],
    }),
    [user, tournamentId]
  );
}
