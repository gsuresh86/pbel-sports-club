import { User, UserRole } from '@/types';
import type { Permission } from '@/types';
import {
  buildTournamentAccessUpdate,
  permissionsForRoleSlugs,
  removeTournamentAccess,
  RoleDefinition,
  ROLE_BY_SLUG,
} from '@/lib/permissions';

export function getStaffForTournament(users: User[], tournamentId: string): User[] {
  return users.filter(
    (u) =>
      u.assignedTournaments?.includes(tournamentId) &&
      (u.role === 'staff' ||
        u.role === 'referee' ||
        u.role === 'tournament-admin' ||
        (u.tournamentRoles?.[tournamentId]?.length ?? 0) > 0)
  );
}

export function getRoleSlugsDisplay(user: User, tournamentId: string): string[] {
  const fromMap = user.tournamentRoles?.[tournamentId];
  if (fromMap?.length) return fromMap;
  if (user.role === 'referee') return ['referee'];
  if (user.role === 'tournament-admin') return ['tournament-admin'];
  return [];
}

export function mergeTournamentRolesForUser(
  user: User,
  tournamentId: string,
  newSlugs: string[]
): Partial<User> {
  const existing = getRoleSlugsDisplay(user, tournamentId);
  const merged = [...new Set([...existing, ...newSlugs])];
  const access = buildTournamentAccessUpdate(
    user.tournamentRoles,
    user.tournamentPermissions,
    user.assignedTournaments,
    tournamentId,
    merged
  );
  return access;
}

export function setTournamentRolesForUser(
  user: User,
  tournamentId: string,
  roleSlugs: string[],
  registry: Record<string, RoleDefinition> = ROLE_BY_SLUG
): Partial<User> {
  return buildTournamentAccessUpdate(
    user.tournamentRoles,
    user.tournamentPermissions,
    user.assignedTournaments,
    tournamentId,
    roleSlugs,
    registry
  );
}

export function stripTournamentFromUser(user: User, tournamentId: string): Partial<User> {
  const access = removeTournamentAccess(
    user.tournamentRoles,
    user.tournamentPermissions,
    user.assignedTournaments,
    tournamentId
  );
  const hasOtherAssignments = access.assignedTournaments.length > 0;
  return {
    ...access,
    ...(hasOtherAssignments ? {} : { role: 'staff' as UserRole }),
  };
}

export function createStaffUserPayload(
  tournamentId: string,
  roleSlugs: string[],
  registry: Record<string, RoleDefinition> = ROLE_BY_SLUG
): {
  role: UserRole;
  assignedTournaments: string[];
  tournamentRoles: Record<string, string[]>;
  tournamentPermissions: Record<string, Permission[]>;
} {
  const access = buildTournamentAccessUpdate(
    undefined,
    undefined,
    undefined,
    tournamentId,
    roleSlugs,
    registry
  );
  return {
    role: access.role,
    assignedTournaments: access.assignedTournaments,
    tournamentRoles: access.tournamentRoles,
    tournamentPermissions: access.tournamentPermissions,
  };
}

export { permissionsForRoleSlugs };
