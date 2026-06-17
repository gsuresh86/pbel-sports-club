'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users,
  Search,
  Trophy,
  Target,
  UserCheck,
  UserX,
  Activity,
  Calendar,
} from 'lucide-react';
import { User, Tournament, UserRole } from '@/types';

interface UserActivity {
  user: User;
  tournamentsManaged: number;
  tournamentsAssigned: string[];
  matchesScored: number;
  registrations: number;
  lastSeen: Date | null;
}

const ROLE_CFG: Record<UserRole | string, { label: string; cls: string }> = {
  'super-admin':      { label: 'Super Admin',       cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  admin:              { label: 'Admin',              cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  'tournament-admin': { label: 'Tournament Admin',   cls: 'bg-green-100 text-green-700 border-green-200' },
  referee:            { label: 'Referee',            cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  staff:              { label: 'Staff',              cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  public:             { label: 'Public',             cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'toDate' in (val as object)) return (val as { toDate(): Date }).toDate();
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return null;
}

export default function UserActivityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    if (!loading && user?.role !== 'super-admin') router.push('/admin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.role !== 'super-admin') return;

    async function load() {
      setFetching(true);
      try {
        const [usersSnap, tournamentsSnap, matchesSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'tournaments')),
          getDocs(query(collection(db, 'matches'), where('status', '==', 'completed'))),
        ]);

        const tournaments = tournamentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament));
        const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));

        const result: UserActivity[] = usersSnap.docs.map((d) => {
          const u = { id: d.id, ...d.data() } as User;

          // Tournaments this user created or is assigned to
          const assignedIds: string[] = u.assignedTournaments ?? [];
          const createdTournaments = tournaments.filter(
            (t) => (t as unknown as Record<string, unknown>).createdBy === u.id,
          );

          // Matches where this user was the scorer/updater
          const scoredMatches = matches.filter(
            (m) => m.updatedBy === u.id || m.createdBy === u.id,
          );

          const createdAt = toDate((d.data() as Record<string, unknown>).createdAt);

          return {
            user: u,
            tournamentsManaged: Math.max(assignedIds.length, createdTournaments.length),
            tournamentsAssigned: assignedIds,
            matchesScored: scoredMatches.length,
            registrations: 0,
            lastSeen: createdAt,
          };
        });

        // Sort: super-admin first, then admin, then others; within role by name
        const roleOrder: Record<string, number> = { 'super-admin': 0, admin: 1, 'tournament-admin': 2, referee: 3, staff: 4, public: 5 };
        result.sort((a, b) => {
          const ro = (roleOrder[a.user.role] ?? 9) - (roleOrder[b.user.role] ?? 9);
          if (ro !== 0) return ro;
          return (a.user.name ?? '').localeCompare(b.user.name ?? '');
        });

        setActivities(result);
      } finally {
        setFetching(false);
      }
    }

    load();
  }, [user]);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const matchesSearch =
        !search ||
        a.user.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.user.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || a.user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [activities, search, roleFilter]);

  // Summary stats
  const totalUsers    = activities.length;
  const activeAdmins  = activities.filter((a) => ['admin', 'super-admin', 'tournament-admin'].includes(a.user.role)).length;
  const referees      = activities.filter((a) => a.user.role === 'referee').length;
  const totalManaged  = activities.reduce((s, a) => s + a.tournamentsManaged, 0);

  if (loading || !user) return null;
  if (user.role !== 'super-admin') return null;

  return (
    <AdminLayout moduleName="User Activity">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900">{totalUsers}</div>
                <div className="text-xs text-muted-foreground">Total Users</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-green-700">{activeAdmins}</div>
                <div className="text-xs text-muted-foreground">Admins</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Target className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-amber-700">{referees}</div>
                <div className="text-xs text-muted-foreground">Referees</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Trophy className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-purple-700">{totalManaged}</div>
                <div className="text-xs text-muted-foreground">Tournaments Managed</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super-admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="tournament-admin">Tournament Admin</SelectItem>
              <SelectItem value="referee">Referee</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              User Activity ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {fetching ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <UserX className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold text-xs">User</TableHead>
                      <TableHead className="font-semibold text-xs">Role</TableHead>
                      <TableHead className="text-center font-semibold text-xs w-24">Tournaments</TableHead>
                      <TableHead className="text-center font-semibold text-xs w-24">Matches</TableHead>
                      <TableHead className="font-semibold text-xs w-32">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Joined
                        </span>
                      </TableHead>
                      <TableHead className="font-semibold text-xs w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => {
                      const roleCfg = ROLE_CFG[a.user.role] ?? ROLE_CFG.public;
                      return (
                        <TableRow key={a.user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                                {(a.user.name ?? a.user.email ?? '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {a.user.name || '—'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{a.user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${roleCfg.cls}`}>
                              {roleCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {a.tournamentsManaged > 0 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                                {a.tournamentsManaged}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {a.matchesScored > 0 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                                {a.matchesScored}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(a.lastSeen)}
                          </TableCell>
                          <TableCell>
                            {a.user.isActive !== false ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
