import { User, UserRole } from '@/types';

/** Named permissions mapped to tournament console route segments. */
export const PERMISSIONS = {
  'tournament.overview': { route: 'overview' },
  'tournament.participants': { route: 'participants' },
  'tournament.players': { route: 'players' },
  'tournament.tshirt-distribution': { route: 'tshirt-distribution' },
  'tournament.teams': { route: 'teams' },
  'tournament.spin-wheel': { route: 'spin-wheel' },
  'tournament.matches': { route: 'matches' },
  'tournament.matches.write': { route: 'matches', write: true },
  'tournament.results': { route: 'results' },
  'tournament.finance': { route: 'finance' },
  'tournament.users': { route: 'users' },
  'tournament.testimonials': { route: 'testimonials' },
} as const;

export type Permission = keyof typeof PERMISSIONS;

export type TournamentRoute =
  | 'overview'
  | 'participants'
  | 'players'
  | 'tshirt-distribution'
  | 'teams'
  | 'spin-wheel'
  | 'matches'
  | 'results'
  | 'finance'
  | 'users'
  | 'testimonials';

export interface RoleDefinition {
  slug: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    slug: 'referee',
    name: 'Referee',
    description: 'Can view and score matches for assigned tournaments.',
    permissions: ['tournament.matches', 'tournament.matches.write'],
    isSystem: true,
  },
  {
    slug: 'tournament-admin',
    name: 'Tournament Admin',
    description: 'Full access to manage an assigned tournament.',
    permissions: [
      'tournament.overview',
      'tournament.participants',
      'tournament.players',
      'tournament.tshirt-distribution',
      'tournament.teams',
      'tournament.spin-wheel',
      'tournament.matches',
      'tournament.matches.write',
      'tournament.results',
      'tournament.finance',
      'tournament.users',
      'tournament.testimonials',
    ],
    isSystem: true,
  },
  {
    slug: 'registration-manager',
    name: 'Registration Manager',
    description: 'Manage registrations and view players.',
    permissions: ['tournament.participants', 'tournament.players', 'tournament.tshirt-distribution'],
    isSystem: true,
  },
  {
    slug: 'finance-viewer',
    name: 'Finance Viewer',
    description: 'View tournament finance data.',
    permissions: ['tournament.finance'],
    isSystem: true,
  },
];

export const ROLE_BY_SLUG = Object.fromEntries(
  DEFAULT_ROLES.map((r) => [r.slug, r])
) as Record<string, RoleDefinition>;

export const ALL_TOURNAMENT_ROUTES: TournamentRoute[] = [
  'overview',
  'participants',
  'players',
  'tshirt-distribution',
  'teams',
  'spin-wheel',
  'matches',
  'results',
  'finance',
  'users',
  'testimonials',
];

export const NAV_ROUTE_ITEMS: { label: string; href: TournamentRoute; permission: Permission }[] = [
  { label: 'Overview', href: 'overview', permission: 'tournament.overview' },
  { label: 'Registrations', href: 'participants', permission: 'tournament.participants' },
  { label: 'Players', href: 'players', permission: 'tournament.players' },
  { label: 'T-Shirt Distribution', href: 'tshirt-distribution', permission: 'tournament.tshirt-distribution' },
  { label: 'Teams', href: 'teams', permission: 'tournament.teams' },
  { label: 'Spin Wheel', href: 'spin-wheel', permission: 'tournament.spin-wheel' },
  { label: 'Matches', href: 'matches', permission: 'tournament.matches' },
  { label: 'Results', href: 'results', permission: 'tournament.results' },
  { label: 'Finance', href: 'finance', permission: 'tournament.finance' },
  { label: 'Users', href: 'users', permission: 'tournament.users' },
  { label: 'Testimonials', href: 'testimonials', permission: 'tournament.testimonials' },
];

/** Tournament console sidebar — testimonials live under /admin/testimonials instead. */
export const TOURNAMENT_SIDEBAR_ITEMS = NAV_ROUTE_ITEMS.filter(
  (item) => item.href !== 'testimonials',
);

/** UI groupings for the role access mapping dialog. */
export const PERMISSION_GROUPS: {
  label: string;
  description: string;
  permissions: { key: Permission; label: string; hint?: string }[];
}[] = [
  {
    label: 'Overview',
    description: 'Tournament dashboard and analytics',
    permissions: [{ key: 'tournament.overview', label: 'View overview' }],
  },
  {
    label: 'Registrations',
    description: 'Participant registration management',
    permissions: [{ key: 'tournament.participants', label: 'Manage registrations' }],
  },
  {
    label: 'Players',
    description: 'Player list and t-shirt tracking',
    permissions: [
      { key: 'tournament.players', label: 'View & manage players' },
      { key: 'tournament.tshirt-distribution', label: 'T-shirt distribution desk' },
    ],
  },
  {
    label: 'Teams',
    description: 'Team and pool management',
    permissions: [{ key: 'tournament.teams', label: 'Manage teams' }],
  },
  {
    label: 'Spin Wheel',
    description: 'Random draw and team assignment',
    permissions: [{ key: 'tournament.spin-wheel', label: 'Use spin wheel' }],
  },
  {
    label: 'Matches',
    description: 'Match schedule and live scoring',
    permissions: [
      { key: 'tournament.matches', label: 'View matches' },
      {
        key: 'tournament.matches.write',
        label: 'Score & update matches',
        hint: 'Requires view matches',
      },
    ],
  },
  {
    label: 'Results',
    description: 'Tournament results and standings',
    permissions: [{ key: 'tournament.results', label: 'View results' }],
  },
  {
    label: 'Finance',
    description: 'Income and expense tracking',
    permissions: [{ key: 'tournament.finance', label: 'View & manage finance' }],
  },
  {
    label: 'Users',
    description: 'Tournament staff assignment',
    permissions: [{ key: 'tournament.users', label: 'Manage tournament staff' }],
  },
  {
    label: 'Testimonials',
    description: 'Add and publish testimonials for the public site',
    permissions: [{ key: 'tournament.testimonials', label: 'Manage testimonials' }],
  },
];

export function slugifyRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function mergeRoleRegistry(
  customRoles: RoleDefinition[]
): Record<string, RoleDefinition> {
  const registry: Record<string, RoleDefinition> = { ...ROLE_BY_SLUG };
  for (const role of customRoles) {
    if (!role.isSystem && role.slug) {
      registry[role.slug] = role;
    }
  }
  return registry;
}

export function normalizeRolePermissions(permissions: Permission[]): Permission[] {
  const set = new Set(permissions);
  if (set.has('tournament.matches.write')) {
    set.add('tournament.matches');
  }
  return [...set];
}

const SYSTEM_ADMIN_ROLES: UserRole[] = ['admin', 'super-admin'];

const LEGACY_TOURNAMENT_STAFF_ROLES: UserRole[] = ['tournament-admin', 'referee', 'staff'];

export function isSystemAdmin(role: UserRole | string | undefined): boolean {
  return !!role && SYSTEM_ADMIN_ROLES.includes(role as UserRole);
}

export function isLegacyTournamentAdmin(role: UserRole | string | undefined): boolean {
  return role === 'tournament-admin';
}

export function isTournamentStaff(role: UserRole | string | undefined): boolean {
  return !!role && LEGACY_TOURNAMENT_STAFF_ROLES.includes(role as UserRole);
}

export function permissionsForRoleSlugs(
  slugs: string[],
  registry: Record<string, RoleDefinition> = ROLE_BY_SLUG
): Permission[] {
  const set = new Set<Permission>();
  for (const slug of slugs) {
    const role = registry[slug];
    if (role) role.permissions.forEach((p) => set.add(p));
  }
  return [...set];
}

/** Legacy role → default slug when tournamentRoles is not set. */
export function legacyRoleSlug(role: UserRole | string | undefined): string | null {
  if (role === 'referee') return 'referee';
  if (role === 'tournament-admin') return 'tournament-admin';
  return null;
}

export function getRoleSlugsForTournament(user: User, tournamentId: string): string[] {
  const fromMap = user.tournamentRoles?.[tournamentId];
  if (fromMap?.length) return fromMap;

  const legacy = legacyRoleSlug(user.role);
  if (legacy && user.assignedTournaments?.includes(tournamentId)) {
    return [legacy];
  }
  return [];
}

export function resolvePermissions(user: User | null, tournamentId?: string): Set<Permission> {
  const perms = new Set<Permission>();

  if (!user) return perms;

  if (isSystemAdmin(user.role)) {
    Object.keys(PERMISSIONS).forEach((p) => perms.add(p as Permission));
    return perms;
  }

  if (user.role === 'tournament-admin' && !tournamentId) {
    Object.keys(PERMISSIONS).forEach((p) => perms.add(p as Permission));
    return perms;
  }

  if (tournamentId) {
    const denormalized = user.tournamentPermissions?.[tournamentId];
    if (denormalized?.length) {
      denormalized.forEach((p) => perms.add(p));
      return perms;
    }

    const slugs = getRoleSlugsForTournament(user, tournamentId);
    permissionsForRoleSlugs(slugs).forEach((p) => perms.add(p));
  }

  return perms;
}

export function hasPermission(
  user: User | null,
  permission: Permission,
  tournamentId?: string
): boolean {
  return resolvePermissions(user, tournamentId).has(permission);
}

export function canAccessTournamentRoute(
  user: User | null,
  route: TournamentRoute,
  tournamentId?: string
): boolean {
  if (!user) return false;
  if (isSystemAdmin(user.role)) return true;
  if (user.role === 'tournament-admin' && !user.tournamentRoles) {
    return tournamentId ? !!user.assignedTournaments?.includes(tournamentId) : true;
  }

  const perms = resolvePermissions(user, tournamentId);
  return NAV_ROUTE_ITEMS.some(
    (item) => item.href === route && perms.has(item.permission)
  );
}

export function canAccessTournamentConsole(user: User | null, tournamentId?: string): boolean {
  if (!user) return false;
  if (isSystemAdmin(user.role)) return true;
  if (user.role === 'tournament-admin') {
    return tournamentId ? !!user.assignedTournaments?.includes(tournamentId) : true;
  }
  if (!isTournamentStaff(user.role)) return false;
  if (!tournamentId) return (user.assignedTournaments?.length ?? 0) > 0;
  return !!user.assignedTournaments?.includes(tournamentId) && resolvePermissions(user, tournamentId).size > 0;
}

export function canWriteMatches(user: User | null, tournamentId: string): boolean {
  return hasPermission(user, 'tournament.matches.write', tournamentId);
}

export function isFullTournamentAdmin(user: User | null, tournamentId: string): boolean {
  if (isSystemAdmin(user?.role)) return true;
  if (user?.role === 'tournament-admin' && user.assignedTournaments?.includes(tournamentId)) {
    return true;
  }
  return hasPermission(user, 'tournament.overview', tournamentId);
}

export function canManageTournamentUsers(user: User | null, tournamentId: string): boolean {
  if (isSystemAdmin(user?.role)) return true;
  if (user?.role === 'tournament-admin' && user.assignedTournaments?.includes(tournamentId)) {
    return true;
  }
  return hasPermission(user, 'tournament.users', tournamentId);
}

export function getAllowedNavItems(user: User | null, tournamentId: string) {
  if (isSystemAdmin(user?.role)) return TOURNAMENT_SIDEBAR_ITEMS;
  if (user?.role === 'tournament-admin' && !user.tournamentRoles && user.assignedTournaments?.includes(tournamentId)) {
    return TOURNAMENT_SIDEBAR_ITEMS;
  }
  const perms = resolvePermissions(user, tournamentId);
  return TOURNAMENT_SIDEBAR_ITEMS.filter((item) => perms.has(item.permission));
}

export function canSubmitTestimonials(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'tournament-admin') return true;
  return (user.assignedTournaments ?? []).some((id) =>
    hasPermission(user, 'tournament.testimonials', id),
  );
}

export function canReviewTestimonials(user: User | null | undefined): boolean {
  return user?.role === 'super-admin';
}

export function getLoginRedirect(user: User): string {
  if (isSystemAdmin(user.role)) return '/admin';
  if (user.role === 'tournament-admin') return '/admin/tournaments';

  const firstTournament = user.assignedTournaments?.[0];
  if (!firstTournament) return '/login';

  const nav = getAllowedNavItems(user, firstTournament);
  const firstRoute = nav[0]?.href ?? 'matches';
  return `/admin/tournaments/${firstTournament}/${firstRoute}`;
}

export function getProfileBackHref(user: User): string {
  if (isSystemAdmin(user.role)) return '/admin';
  if (user.role === 'tournament-admin') return '/admin/tournaments';
  if (isTournamentStaff(user.role)) return getLoginRedirect(user);
  return '/tournament';
}

export function buildTournamentAccessUpdate(
  existingRoles: Record<string, string[]> | undefined,
  existingPermissions: Record<string, Permission[]> | undefined,
  existingAssigned: string[] | undefined,
  tournamentId: string,
  roleSlugs: string[],
  registry: Record<string, RoleDefinition> = ROLE_BY_SLUG
): {
  tournamentRoles: Record<string, string[]>;
  tournamentPermissions: Record<string, Permission[]>;
  assignedTournaments: string[];
  role: UserRole;
} {
  const tournamentRoles = { ...(existingRoles ?? {}), [tournamentId]: roleSlugs };
  const permissions = permissionsForRoleSlugs(roleSlugs, registry);
  const tournamentPermissions = {
    ...(existingPermissions ?? {}),
    [tournamentId]: permissions,
  };

  const assignedSet = new Set(existingAssigned ?? []);
  if (roleSlugs.length > 0) assignedSet.add(tournamentId);
  else assignedSet.delete(tournamentId);

  if (roleSlugs.length === 0) {
    delete tournamentRoles[tournamentId];
    delete tournamentPermissions[tournamentId];
  }

  return {
    tournamentRoles,
    tournamentPermissions,
    assignedTournaments: [...assignedSet],
    role: 'staff',
  };
}

export function removeTournamentAccess(
  existingRoles: Record<string, string[]> | undefined,
  existingPermissions: Record<string, Permission[]> | undefined,
  existingAssigned: string[] | undefined,
  tournamentId: string
): {
  tournamentRoles: Record<string, string[]>;
  tournamentPermissions: Record<string, Permission[]>;
  assignedTournaments: string[];
} {
  const tournamentRoles = { ...(existingRoles ?? {}) };
  const tournamentPermissions = { ...(existingPermissions ?? {}) };
  delete tournamentRoles[tournamentId];
  delete tournamentPermissions[tournamentId];
  const assignedTournaments = (existingAssigned ?? []).filter((id) => id !== tournamentId);
  return { tournamentRoles, tournamentPermissions, assignedTournaments };
}
