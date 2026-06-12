import { User, UserRole } from '@/types';
import { DEFAULT_ROLES, getProfileBackHref as getProfileBackHrefFromPermissions } from '@/lib/permissions';

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
    case 'staff':
      return 'Staff';
    case 'public':
      return 'Member';
    default:
      return role;
  }
}

export function getRoleSlugLabel(slug: string): string {
  return DEFAULT_ROLES.find((r) => r.slug === slug)?.name ?? slug;
}

export function getProfileBackHref(user: User): string;
export function getProfileBackHref(role: UserRole, assignedTournaments?: string[]): string;
export function getProfileBackHref(
  userOrRole: User | UserRole,
  assignedTournaments?: string[]
): string {
  if (typeof userOrRole === 'object') {
    return getProfileBackHrefFromPermissions(userOrRole);
  }
  return getProfileBackHrefFromPermissions({
    id: '',
    email: '',
    name: '',
    role: userOrRole,
    assignedTournaments,
    createdAt: new Date(),
  });
}
