'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, collectionGroup, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users,
  Search,
  Trophy,
  LogIn,
  Filter,
  Calendar,
  Activity,
} from 'lucide-react';
import { User, Tournament } from '@/types';
import type { UserActivityEvent, UserActivityType } from '@/lib/user-activity';

interface UserRow {
  user: User;
  lastLoginAt: Date | null;
  joinedAt: Date | null;
  tournamentsCreated: number;
}

const ROLE_CFG: Record<string, { label: string; cls: string }> = {
  'super-admin': { label: 'Super Admin', cls: 'bg-violet-50 text-violet-700 border-violet-100' },
  admin: { label: 'Admin', cls: 'bg-rose-50 text-rose-700 border-rose-100' },
  'tournament-admin': { label: 'Tournament Admin', cls: 'bg-sky-50 text-sky-700 border-sky-100' },
  referee: { label: 'Referee', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  staff: { label: 'Staff', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  public: { label: 'Public', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val === 'object' && val && 'toDate' in val) {
    const d = (val as { toDate(): Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtRelative(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(d);
}

function eventKey(event: UserActivityEvent) {
  return [event.type, event.userId, event.tournamentId || '', event.title, event.createdAt.toISOString().slice(0, 13)].join(':');
}

function eventMeta(type: UserActivityType) {
  switch (type) {
    case 'login':
      return { label: 'Login', icon: LogIn, wrap: 'bg-sky-50 text-sky-700 border-sky-100' };
    case 'tournament_created':
      return { label: 'Tournament', icon: Trophy, wrap: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'user_created':
      return { label: 'Account', icon: Users, wrap: 'bg-slate-100 text-slate-600 border-slate-200' };
    case 'match_scored':
      return { label: 'Match', icon: Activity, wrap: 'bg-amber-50 text-amber-700 border-amber-100' };
    default:
      return { label: 'Activity', icon: Activity, wrap: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
}

export default function UserActivityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [events, setEvents] = useState<UserActivityEvent[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user?.role !== 'super-admin') router.push('/admin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.role !== 'super-admin') return;

    async function load() {
      setFetching(true);
      try {
        const [usersSnap, tournamentsSnap, activitySnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'tournaments')),
          getDocs(query(collection(db, 'userActivity'), orderBy('createdAt', 'desc'), limit(200))).catch(() => null),
        ]);

        const users = usersSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: toDate(data.createdAt) || new Date(0),
            lastLoginAt: toDate(data.lastLoginAt) || undefined,
          } as User;
        });

        const tournaments = tournamentsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: toDate(data.createdAt) || new Date(0),
          } as Tournament & { createdBy?: string };
        });

        const userMap = new Map(users.map((u) => [u.id, u]));
        const derived: UserActivityEvent[] = [];

        for (const u of users) {
          if (u.createdAt && u.createdAt.getTime() > 0) {
            derived.push({
              userId: u.id,
              userName: u.name,
              userEmail: u.email,
              type: 'user_created',
              title: 'Account created',
              createdAt: u.createdAt,
              source: 'derived',
            });
          }
          if (u.lastLoginAt) {
            derived.push({
              userId: u.id,
              userName: u.name,
              userEmail: u.email,
              type: 'login',
              title: 'Logged in',
              createdAt: u.lastLoginAt,
              source: 'derived',
            });
          }
        }

        for (const t of tournaments) {
          const creatorId = t.createdBy;
          if (!creatorId) continue;
          const creator = userMap.get(creatorId);
          derived.push({
            userId: creatorId,
            userName: creator?.name,
            userEmail: creator?.email,
            type: 'tournament_created',
            title: `Created tournament “${t.name}”`,
            tournamentId: t.id,
            tournamentName: t.name,
            createdAt: t.createdAt,
            source: 'derived',
          });
        }

        try {
          const matchesSnap = await getDocs(query(collectionGroup(db, 'matches'), limit(200)));
          for (const matchDoc of matchesSnap.docs) {
            const data = matchDoc.data();
            if (data.status !== 'completed') continue;
            const scorerId = (data.updatedBy || data.createdBy) as string | undefined;
            if (!scorerId) continue;
            const when = toDate(data.updatedAt) || toDate(data.createdAt);
            if (!when) continue;
            const scorer = userMap.get(scorerId);
            const tournamentId = matchDoc.ref.parent.parent?.id;
            const tournament = tournaments.find((t) => t.id === tournamentId);
            derived.push({
              userId: scorerId,
              userName: scorer?.name,
              userEmail: scorer?.email,
              type: 'match_scored',
              title: `Scored a match${tournament ? ` in “${tournament.name}”` : ''}`,
              tournamentId,
              tournamentName: tournament?.name,
              createdAt: when,
              source: 'derived',
            });
          }
        } catch (error) {
          console.warn('Could not load match activity:', error);
        }

        const live: UserActivityEvent[] = activitySnap
          ? activitySnap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                userId: data.userId as string,
                userName: data.userName as string | undefined,
                userEmail: data.userEmail as string | undefined,
                type: data.type as UserActivityType,
                title: data.title as string,
                detail: data.detail as string | undefined,
                tournamentId: data.tournamentId as string | undefined,
                tournamentName: data.tournamentName as string | undefined,
                createdAt: toDate(data.createdAt) || new Date(0),
                source: 'live',
              };
            })
          : [];

        const merged = [...live, ...derived]
          .filter((event) => event.createdAt.getTime() > 0)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const seen = new Set<string>();
        const unique = merged.filter((event) => {
          const key = eventKey(event);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const createdCounts = tournaments.reduce<Record<string, number>>((acc, t) => {
          if (!t.createdBy) return acc;
          acc[t.createdBy] = (acc[t.createdBy] || 0) + 1;
          return acc;
        }, {});

        const nextRows: UserRow[] = users
          .map((u) => ({
            user: u,
            lastLoginAt: u.lastLoginAt || null,
            joinedAt: u.createdAt,
            tournamentsCreated: createdCounts[u.id] || 0,
          }))
          .sort((a, b) => {
            const aTime = a.lastLoginAt?.getTime() || 0;
            const bTime = b.lastLoginAt?.getTime() || 0;
            return bTime - aTime;
          });

        setRows(nextRows);
        setEvents(unique);
      } finally {
        setFetching(false);
      }
    }

    load();
  }, [user]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        row.user.name?.toLowerCase().includes(search.toLowerCase()) ||
        row.user.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || row.user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [rows, search, roleFilter]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesUser = !selectedUserId || event.userId === selectedUserId;
      const matchesType = typeFilter === 'all' || event.type === typeFilter;
      const matchesSearch =
        !search ||
        event.userName?.toLowerCase().includes(search.toLowerCase()) ||
        event.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
        event.title.toLowerCase().includes(search.toLowerCase());
      return matchesUser && matchesType && matchesSearch;
    });
  }, [events, selectedUserId, typeFilter, search]);

  const selectedUser = rows.find((row) => row.user.id === selectedUserId)?.user;
  const loggedInCount = rows.filter((row) => row.lastLoginAt).length;
  const tournamentsCreated = events.filter((event) => event.type === 'tournament_created').length;

  if (loading || !user) return null;
  if (user.role !== 'super-admin') return null;

  return (
    <AdminLayout moduleName="User Activity">
      <div className="min-h-full bg-[#f4f5f7] p-6 lg:p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border-slate-200 bg-slate-50 shadow-none gap-0 py-3">
            <CardContent className="px-5">
              <p className="text-sm text-slate-500">Total Users</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{rows.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-sky-100 bg-sky-50 shadow-none gap-0 py-3">
            <CardContent className="px-5">
              <p className="text-sm text-sky-700/80">Logged In</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{loggedInCount}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-emerald-100 bg-emerald-50 shadow-none gap-0 py-3">
            <CardContent className="px-5">
              <p className="text-sm text-emerald-700/80">Tournaments Created</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{tournamentsCreated}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-amber-100 bg-amber-50 shadow-none gap-0 py-3">
            <CardContent className="px-5">
              <p className="text-sm text-amber-700/80">Timeline Events</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{events.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 rounded-2xl border-slate-200/80 bg-white shadow-none gap-0 py-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Activity Timeline</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedUser
                  ? `Showing activity for ${selectedUser.name}`
                  : `Showing ${filteredEvents.length} events`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search users or activity"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full sm:w-64 rounded-xl border-slate-200 bg-white pl-9 text-sm focus-ring-thin"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-full sm:w-40 rounded-xl border-slate-200 focus-ring-thin">
                  <Filter className="h-3 w-3 mr-1 text-slate-400" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activity</SelectItem>
                  <SelectItem value="login">Logins</SelectItem>
                  <SelectItem value="tournament_created">Tournaments</SelectItem>
                  <SelectItem value="match_scored">Matches</SelectItem>
                  <SelectItem value="user_created">Accounts</SelectItem>
                </SelectContent>
              </Select>
              {selectedUserId && (
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={() => setSelectedUserId(null)}
                >
                  Clear user
                </Button>
              )}
            </div>
          </div>

          {fetching ? (
            <div className="py-16 text-center text-sm text-slate-400">Loading activity…</div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-900">No activity yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                Logins and new tournaments will appear here as they happen.
              </p>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-auto px-5 py-4">
              <ol className="relative space-y-0 border-l border-slate-200 ml-3">
                {filteredEvents.slice(0, 80).map((event, index) => {
                  const meta = eventMeta(event.type);
                  const Icon = meta.icon;
                  return (
                    <li key={`${event.id || eventKey(event)}-${index}`} className="relative pb-5 last:pb-0 pl-6">
                      <span className="absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-200">
                        <span className="h-2 w-2 rounded-full bg-slate-500" />
                      </span>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`rounded-full border ${meta.wrap}`}>
                              <Icon className="mr-1 h-3 w-3" />
                              {meta.label}
                            </Badge>
                            <button
                              type="button"
                              className="text-sm font-medium text-slate-900 hover:underline"
                              onClick={() => setSelectedUserId(event.userId)}
                            >
                              {event.userName || event.userEmail || 'Unknown user'}
                            </button>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{event.title}</p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">
                          {fmtRelative(event.createdAt)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-none gap-0 py-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">All Users</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Showing {filteredRows.length} of {rows.length}
              </p>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-full sm:w-44 rounded-xl border-slate-200 focus-ring-thin">
                <Filter className="h-3 w-3 mr-1 text-slate-400" />
                <SelectValue placeholder="Role" />
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

          {filteredRows.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">No users found</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/60">
                    <TableHead className="h-11 pl-5 text-xs font-medium text-slate-400">User</TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">Role</TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">Last login</TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">Tournaments</TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">Joined</TableHead>
                    <TableHead className="h-11 pr-5 text-xs font-medium text-slate-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => {
                    const roleCfg = ROLE_CFG[row.user.role] ?? ROLE_CFG.public;
                    const selected = selectedUserId === row.user.id;
                    return (
                      <TableRow
                        key={row.user.id}
                        className={`cursor-pointer border-slate-50 ${
                          selected ? 'bg-sky-50' : index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                        } hover:bg-slate-50`}
                        onClick={() => setSelectedUserId(selected ? null : row.user.id)}
                      >
                        <TableCell className="pl-5 py-3.5">
                          <div className="font-medium text-slate-900">{row.user.name || '—'}</div>
                          <div className="text-xs text-slate-400">{row.user.email}</div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge className={`rounded-full border ${roleCfg.cls}`}>{roleCfg.label}</Badge>
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-700">
                          {row.lastLoginAt ? fmtRelative(row.lastLoginAt) : 'Never'}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-700">
                          {row.tournamentsCreated || '—'}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Calendar className="h-3 w-3 text-slate-300" />
                            {fmtDate(row.joinedAt)}
                          </div>
                        </TableCell>
                        <TableCell className="pr-5 py-3.5">
                          <Badge
                            className={`rounded-full border ${
                              row.user.isActive !== false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}
                          >
                            {row.user.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
