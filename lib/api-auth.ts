import { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth, getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';
import { isSystemAdmin } from '@/lib/permissions';
import type { User, UserRole } from '@/types';

export async function verifyAuthToken(request: Request): Promise<DecodedIdToken | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

function toUser(id: string, data: Record<string, unknown>): User {
  const createdAt = data.createdAt as { toDate?: () => Date } | Date | undefined;
  const updatedAt = data.updatedAt as { toDate?: () => Date } | Date | undefined;

  return {
    id,
    email: (data.email as string) ?? '',
    name: (data.name as string) ?? '',
    role: data.role as UserRole,
    assignedTournaments: data.assignedTournaments as string[] | undefined,
    tournamentRoles: data.tournamentRoles as User['tournamentRoles'],
    tournamentPermissions: data.tournamentPermissions as User['tournamentPermissions'],
    isActive: data.isActive as boolean | undefined,
    createdAt:
      createdAt && typeof createdAt === 'object' && 'toDate' in createdAt && createdAt.toDate
        ? createdAt.toDate()
        : createdAt instanceof Date
          ? createdAt
          : new Date(),
    updatedAt:
      updatedAt && typeof updatedAt === 'object' && 'toDate' in updatedAt && updatedAt.toDate
        ? updatedAt.toDate()
        : updatedAt instanceof Date
          ? updatedAt
          : undefined,
    createdBy: data.createdBy as string | undefined,
    profilePhotoUrl: data.profilePhotoUrl as string | undefined,
  };
}

export async function getCallerUser(request: Request): Promise<User | null> {
  if (!isAdminConfigured()) return null;

  const decoded = await verifyAuthToken(request);
  if (!decoded) return null;

  const snap = await getAdminFirestore().collection('users').doc(decoded.uid).get();
  if (!snap.exists) return null;

  const user = toUser(snap.id, snap.data() as Record<string, unknown>);
  if (user.isActive === false) return null;
  return user;
}

/** System admins, or legacy/global tournament-admins. */
export function canManageUsers(user: User): boolean {
  return isSystemAdmin(user.role) || user.role === 'tournament-admin';
}

/** Staff who can create tournament-scoped staff accounts. */
export function canCreateTournamentStaff(user: User, tournamentId?: string): boolean {
  if (canManageUsers(user)) return true;
  if (!tournamentId) return false;
  if (!user.assignedTournaments?.includes(tournamentId)) return false;
  const roles = user.tournamentRoles?.[tournamentId] ?? [];
  const perms = user.tournamentPermissions?.[tournamentId] ?? [];
  return (
    roles.includes('tournament-admin') ||
    perms.includes('tournament.users') ||
    perms.includes('tournament.overview')
  );
}
