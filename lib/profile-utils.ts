import { UserRole } from '@/types';

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'super-admin':
      return 'Super Admin';
    case 'tournament-admin':
      return 'Tournament Admin';
    case 'referee':
      return 'Referee';
    case 'public':
      return 'Member';
    default:
      return role;
  }
}

export function getProfileBackHref(
  role: UserRole,
  assignedTournaments?: string[]
): string {
  switch (role) {
    case 'admin':
    case 'super-admin':
      return '/admin';
    case 'tournament-admin':
      return '/admin/tournaments';
    case 'referee': {
      const tournamentId = assignedTournaments?.[0];
      return tournamentId
        ? `/admin/tournaments/${tournamentId}/matches`
        : '/login';
    }
    default:
      return '/tournament';
  }
}
