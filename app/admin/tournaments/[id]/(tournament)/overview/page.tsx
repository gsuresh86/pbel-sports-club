'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  doc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  useTournament,
  useTournamentRegistrations,
  useTournamentMatches,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User } from '@/types';
import { dedupeByNamePhone, parsePaymentRecipient, cn } from '@/lib/utils';
import {
  Users,
  DollarSign,
  Clock,
  Activity,
  TrendingUp,
  UserCheck,
  UserX,
  BarChart3,
  HandHeart,
  Home,
  Shirt,
  IndianRupee,
  ChevronDown,
  Users2,
  UserPlus,
  X,
  PieChart,
  Trophy,
} from 'lucide-react';
import VolunteersListDrawer from '@/components/admin/VolunteersListDrawer';

const TSHIRT_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

export default function OverviewPage() {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const queriesEnabled = !!user && isAdminRole(user.role) && !!tournamentId;

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: registrationsData = [] } = useTournamentRegistrations(tournamentId, { enabled: queriesEnabled });
  const { data: matchesData = [] } = useTournamentMatches(tournamentId, { enabled: queriesEnabled });
  const invalidateTournament = useInvalidateTournament();

  const tournament = tournamentData ?? null;
  const participants = registrationsData;
  const matches = matchesData;

  const isFullAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [tournamentAdmins, setTournamentAdmins] = useState<User[]>([]);
  const [volunteersDrawerOpen, setVolunteersDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isFullAdmin) return;
    getDocs(query(collection(db, 'users'), where('role', '==', 'tournament-admin'))).then((snap) => {
      setTournamentAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
    });
  }, [isFullAdmin]);

  const refreshAdmins = () => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'tournament-admin'))).then((snap) => {
      setTournamentAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
    });
  };

  const addAdminToTournament = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { assignedTournaments: arrayUnion(tournamentId), updatedAt: new Date() });
    refreshAdmins();
  };

  const removeAdminFromTournament = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { assignedTournaments: arrayRemove(tournamentId), updatedAt: new Date() });
    refreshAdmins();
  };

  const assignedAdmins = tournamentAdmins.filter((u) => u.assignedTournaments?.includes(tournamentId));
  const unassignedAdmins = tournamentAdmins.filter((u) => !u.assignedTournaments?.includes(tournamentId));

  const analytics = useMemo(() => {
    const catMap = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
    participants.forEach((p) => {
      if (!catMap.has(p.selectedCategory)) catMap.set(p.selectedCategory, { total: 0, approved: 0, pending: 0, rejected: 0 });
      const e = catMap.get(p.selectedCategory)!;
      e.total++;
      e[p.registrationStatus as 'approved' | 'pending' | 'rejected']++;
    });
    const categories = Array.from(catMap.entries()).sort((a, b) => b[1].total - a[1].total);

    const gender = { male: 0, female: 0, other: 0 };
    participants.forEach((p) => { gender[p.gender as keyof typeof gender] = (gender[p.gender as keyof typeof gender] || 0) + 1; });

    const level = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
    participants.forEach((p) => { level[p.expertiseLevel as keyof typeof level] = (level[p.expertiseLevel as keyof typeof level] || 0) + 1; });

    const paid = participants.filter((p) => p.paymentStatus === 'paid');
    const totalRevenue = paid.reduce((sum, p) => sum + (p.paymentAmount ?? 0), 0);
    const pendingPayment = participants.filter((p) => p.paymentStatus === 'pending').length;
    const pendingRegistrations = participants.filter((p) => p.registrationStatus === 'pending');
    const pendingRegistrationCount = pendingRegistrations.length;
    const expectedFromPendingRegistrations = pendingRegistrations.reduce((sum, p) => sum + (p.paymentAmount ?? 0), 0);

    const volunteers = dedupeByNamePhone(participants.filter((p) => p.isVolunteer === true)).sort((a, b) => a.name.localeCompare(b.name));
    const volunteerCount = volunteers.length;
    const residentCount = participants.filter((p) => p.isResident === true).length;
    const nonResidentCount = participants.filter((p) => p.isResident === false).length;

    const dateMap = new Map<string, number>();
    participants.forEach((p) => {
      const d = new Date(p.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      dateMap.set(d, (dateMap.get(d) ?? 0) + 1);
    });
    const timeline = Array.from(dateMap.entries());

    const tshirtMap = new Map<string, number>();
    const seenTshirtNames = new Set<string>();
    const addTshirtSize = (name: string, size?: string) => {
      const nameKey = name.trim().toLowerCase();
      if (!nameKey || seenTshirtNames.has(nameKey)) return;
      seenTshirtNames.add(nameKey);
      const key = size?.trim() || 'Not specified';
      tshirtMap.set(key, (tshirtMap.get(key) ?? 0) + 1);
    };
    participants.forEach((p) => {
      addTshirtSize(p.name, p.tshirtSize);
      if (p.partnerName?.trim()) addTshirtSize(p.partnerName, p.partnerTshirtSize);
    });
    const tshirtSizes = Array.from(tshirtMap.entries()).sort(([a], [b]) => {
      if (a === 'Not specified') return 1;
      if (b === 'Not specified') return -1;
      const orderA = TSHIRT_SIZE_ORDER.indexOf(a as (typeof TSHIRT_SIZE_ORDER)[number]);
      const orderB = TSHIRT_SIZE_ORDER.indexOf(b as (typeof TSHIRT_SIZE_ORDER)[number]);
      if (orderA === -1 && orderB === -1) return a.localeCompare(b);
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      return orderA - orderB;
    });
    const totalTshirts = tshirtSizes.reduce((sum, [, count]) => sum + count, 0);

    return {
      categories,
      gender,
      level,
      totalRevenue,
      paidCount: paid.length,
      pendingPayment,
      pendingRegistrationCount,
      expectedFromPendingRegistrations,
      volunteerCount,
      volunteers,
      residentCount,
      nonResidentCount,
      timeline,
      tshirtSizes,
      totalTshirts,
    };
  }, [participants]);

  const revenueByReceiver = useMemo(() => {
    const map = new Map<string, { name: string; number: string; amount: number; count: number }>();
    (tournament?.paymentAccounts ?? []).forEach((account) => {
      const key = `${account.name}||${account.number}`;
      map.set(key, { name: account.name, number: account.number, amount: 0, count: 0 });
    });
    participants
      .filter((p) => p.paymentStatus === 'paid')
      .forEach((p) => {
        const recipient = parsePaymentRecipient(p.selectedPaymentAccount);
        const key = p.selectedPaymentAccount?.trim() || '__unassigned__';
        const name = recipient?.name || 'Unassigned';
        const number = recipient?.number || '';
        const entry = map.get(key) ?? { name, number, amount: 0, count: 0 };
        entry.amount += p.paymentAmount ?? 0;
        entry.count += 1;
        map.set(key, entry);
      });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [participants, tournament?.paymentAccounts]);

  const volunteersList = useMemo(
    () => dedupeByNamePhone(participants.filter((p) => p.isVolunteer === true)).sort((a, b) => a.name.localeCompare(b.name)),
    [participants],
  );

  if (!tournament) return null;

  const totalParticipants = participants.length;
  const approvedParticipants = participants.filter((p) => p.registrationStatus === 'approved').length;
  const pendingParticipants = participants.filter((p) => p.registrationStatus === 'pending').length;
  const rejectedParticipants = participants.filter((p) => p.registrationStatus === 'rejected').length;
  const paidParticipants = participants.filter((p) => p.paymentStatus === 'paid').length;
  const totalMatches = matches.length;
  const completedMatches = matches.filter((m) => m.status === 'completed').length;
  const liveMatches = matches.filter((m) => m.status === 'live').length;

  return (
    <div className="space-y-3">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8 sm:gap-2">
        {[
          { label: 'Participants', value: `${totalParticipants}/${tournament.maxParticipants || '∞'}`, icon: Users, color: 'text-blue-500', sub: tournament.maxParticipants ? `${Math.round((totalParticipants / tournament.maxParticipants) * 100)}% cap` : 'Unlimited' },
          { label: 'Approved', value: String(approvedParticipants), icon: UserCheck, color: 'text-green-500', sub: totalParticipants > 0 ? `${Math.round((approvedParticipants / totalParticipants) * 100)}%` : '0%' },
          { label: 'Pending', value: String(pendingParticipants), icon: Clock, color: 'text-amber-500', sub: 'registration' },
          { label: 'Rejected', value: String(rejectedParticipants), icon: UserX, color: 'text-red-500', sub: 'registration' },
          { label: 'Revenue', value: `₹${analytics.totalRevenue.toLocaleString('en-IN')}`, icon: DollarSign, color: 'text-green-600', sub: `${analytics.paidCount} paid` },
          { label: 'Expected', value: `₹${analytics.expectedFromPendingRegistrations.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-amber-600', sub: `${analytics.pendingRegistrationCount} pending`, highlight: true },
          { label: 'Pay pending', value: String(analytics.pendingPayment), icon: Clock, color: 'text-orange-500', sub: 'payment' },
          { label: 'Matches', value: String(totalMatches), icon: Activity, color: 'text-purple-500', sub: `${completedMatches} done · ${liveMatches} live` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1.5 sm:px-2.5 sm:py-2',
              (kpi as any).highlight ? 'border-amber-200 bg-amber-50/80' : 'bg-card',
            )}
          >
            <kpi.icon className={cn('h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4', kpi.color)} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] leading-none text-muted-foreground truncate">{kpi.label}</p>
              <p className="truncate text-xs sm:text-sm font-semibold leading-tight tabular-nums">{kpi.value}</p>
              <p className="truncate text-[10px] leading-tight text-muted-foreground">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Collections by recipient + community quick stats */}
      <Card className="py-4">
        <CardContent className="px-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <button
              type="button"
              onClick={() => setCollectionsOpen((o) => !o)}
              aria-expanded={collectionsOpen}
              className="flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <IndianRupee className="h-4 w-4" /> Collections by recipient
              <ChevronDown className={`h-4 w-4 transition-transform ${collectionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {collectionsOpen && (
              revenueByReceiver.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {revenueByReceiver.map((receiver) => (
                    <span
                      key={`${receiver.name}-${receiver.number}`}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
                      title={receiver.number || undefined}
                    >
                      <span className="font-medium">{receiver.name}</span>
                      <span className="tabular-nums">
                        <span className="font-semibold">₹{receiver.amount.toLocaleString('en-IN')}</span>
                        <span className="text-muted-foreground"> · {receiver.count} paid</span>
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No payments collected yet.</span>
              )
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{paidParticipants} of {totalParticipants} paid</span>
              <button
                type="button"
                onClick={() => analytics.volunteerCount > 0 && setVolunteersDrawerOpen(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm',
                  analytics.volunteerCount > 0
                    ? 'bg-pink-50 border-pink-200 hover:bg-pink-100 cursor-pointer'
                    : 'bg-card text-muted-foreground',
                )}
              >
                <HandHeart className="h-4 w-4 text-pink-500" />
                <span className="font-medium">{analytics.volunteerCount}</span> volunteers
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm">
                <Home className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{analytics.residentCount}</span> residents
                <span className="text-muted-foreground">· {analytics.nonResidentCount} other</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manage Tournament Admins */}
      {isFullAdmin && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users2 className="h-4 w-4 sm:h-5 sm:w-5" />
                Tournament Admins
              </CardTitle>
              {unassignedAdmins.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setAdminDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add Admin
                </Button>
              )}
            </div>
            <CardDescription>Users who can manage this tournament</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {assignedAdmins.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No admins assigned yet.{' '}
                {unassignedAdmins.length > 0 && (
                  <button className="underline text-primary" onClick={() => setAdminDialogOpen(true)}>Add one</button>
                )}
                {unassignedAdmins.length === 0 && 'Create tournament-admin users first.'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignedAdmins.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5 text-sm">
                    <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 font-semibold text-xs flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-blue-900 leading-tight truncate max-w-[120px]">{u.name}</p>
                      <p className="text-[10px] text-blue-600 truncate max-w-[120px]">{u.email}</p>
                    </div>
                    <button
                      onClick={() => removeAdminFromTournament(u.id)}
                      className="ml-1 text-blue-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {participants.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No registration insights yet</h3>
            <p className="text-muted-foreground text-sm">Charts and breakdowns will appear once registrations come in.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* By Category */}
            <Card>
              <CardHeader className="px-3 py-2.5 sm:px-4 sm:py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  By Category
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {participants.length} registrations across {analytics.categories.length} categor{analytics.categories.length === 1 ? 'y' : 'ies'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                {analytics.categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No category data yet.</p>
                ) : (() => {
                  const maxTotal = Math.max(...analytics.categories.map(([, c]) => c.total));
                  const CHART_H = 140;
                  const abbrev = (cat: string) =>
                    cat.replace('girls-under', 'G-U').replace('boys-under', 'B-U')
                       .replace('womens-', 'W-').replace('mens-', 'M-')
                       .replace('mixed-doubles', 'Mixed').replace('open-team', 'Open')
                       .replace('kids-team-u', 'Kids-U').replace('-', ' ');
                  return (
                    <>
                      <div className="overflow-x-auto">
                        <div className="flex items-end gap-2 min-w-max pb-1" style={{ height: CHART_H + 32 }}>
                          {analytics.categories.map(([cat, counts]) => {
                            const colH = maxTotal ? Math.round((counts.total / maxTotal) * CHART_H) : 4;
                            const approvedH = counts.total ? Math.round((counts.approved / counts.total) * colH) : 0;
                            const pendingH = counts.total ? Math.round((counts.pending / counts.total) * colH) : 0;
                            const rejectedH = colH - approvedH - pendingH;
                            return (
                              <div key={cat} className="flex flex-col items-center gap-1 w-14 flex-shrink-0" title={cat.replace(/-/g, ' ')}>
                                <span className="text-[11px] font-semibold text-gray-700 tabular-nums">{counts.total}</span>
                                <div className="w-10 flex flex-col-reverse overflow-hidden rounded-t" style={{ height: colH, minHeight: 4 }}>
                                  <div className="w-full bg-green-500 transition-all" style={{ height: approvedH }} />
                                  <div className="w-full bg-amber-400 transition-all" style={{ height: pendingH }} />
                                  <div className="w-full bg-red-400 transition-all" style={{ height: rejectedH }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground text-center leading-tight capitalize w-full truncate">{abbrev(cat)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" />approved</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />pending</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400" />rejected</span>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* T-Shirt Sizes */}
            <Card>
              <CardHeader className="px-3 py-2.5 sm:px-4 sm:py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shirt className="h-4 w-4" />
                  T-Shirt Sizes
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {analytics.totalTshirts} shirts total (players + partners)
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4 space-y-1.5">
                {analytics.tshirtSizes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No t-shirt size data yet.</p>
                ) : (
                  analytics.tshirtSizes.map(([size, count]) => {
                    const pct = analytics.totalTshirts ? Math.round((count / analytics.totalTshirts) * 100) : 0;
                    const barColors: Record<string, string> = {
                      XS: 'bg-slate-400', S: 'bg-sky-400', M: 'bg-teal-500',
                      L: 'bg-indigo-500', XL: 'bg-violet-500', XXL: 'bg-fuchsia-500', XXXL: 'bg-rose-500',
                    };
                    const barColor = barColors[size] ?? (size === 'Not specified' ? 'bg-gray-400' : 'bg-amber-500');
                    return (
                      <div key={size} className="flex items-center gap-3">
                        <span className="text-sm w-24 flex-shrink-0 text-gray-600 truncate" title={size}>{size}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                          <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-gray-700">{count}</span>
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Gender + Level */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="py-0">
              <CardHeader className="px-3 py-2.5">
                <CardTitle className="text-sm flex items-center gap-1.5"><PieChart className="h-3.5 w-3.5" />Gender Split</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 space-y-1">
                {(['male', 'female', 'other'] as const).map((g) => {
                  const count = analytics.gender[g];
                  const pct = participants.length ? Math.round((count / participants.length) * 100) : 0;
                  const colors = { male: 'bg-blue-500', female: 'bg-pink-500', other: 'bg-purple-400' };
                  return (
                    <div key={g} className="flex items-center gap-2">
                      <span className="text-xs capitalize w-12 flex-shrink-0 text-gray-600">{g}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                        <div className={`h-full ${colors[g]} transition-all`} style={{ width: `${pct}%` }} />
                        <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[11px] font-semibold text-gray-700">{count}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground w-7 text-right tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="py-0">
              <CardHeader className="px-3 py-2.5">
                <CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Expertise Level</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 space-y-1">
                {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((l) => {
                  const count = analytics.level[l];
                  const pct = participants.length ? Math.round((count / participants.length) * 100) : 0;
                  const colors = { beginner: 'bg-emerald-400', intermediate: 'bg-blue-400', advanced: 'bg-violet-500', expert: 'bg-orange-500' };
                  return (
                    <div key={l} className="flex items-center gap-2">
                      <span className="text-xs capitalize w-16 flex-shrink-0 text-gray-600 truncate" title={l}>{l}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                        <div className={`h-full ${colors[l]} transition-all`} style={{ width: `${pct}%` }} />
                        <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[11px] font-semibold text-gray-700">{count}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground w-7 text-right tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Daily registration timeline */}
          {analytics.timeline.length > 1 && (
            <Card>
              <CardHeader className="px-3 py-2.5 sm:px-4 sm:py-3">
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Daily Registrations</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-2 min-w-max h-24 px-0.5">
                    {(() => {
                      const maxDay = Math.max(...analytics.timeline.map(([, c]) => c));
                      return analytics.timeline.map(([date, count]) => (
                        <div key={date} className="flex flex-col items-center gap-1 w-10">
                          <span className="text-xs font-semibold text-gray-700">{count}</span>
                          <div
                            className="w-8 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                            style={{ height: `${maxDay ? (count / maxDay) * 72 : 4}px`, minHeight: '4px' }}
                            title={`${date}: ${count} registrations`}
                          />
                          <span className="text-[9px] text-muted-foreground text-center leading-tight">{date}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add Admin Dialog */}
      {isFullAdmin && (
        <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Tournament Admin</DialogTitle>
              <DialogDescription>Select a user to give access to this tournament.</DialogDescription>
            </DialogHeader>
            {unassignedAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All tournament-admin users are already assigned.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto py-2">
                {unassignedAdmins.map((u) => (
                  <button
                    key={u.id}
                    onClick={async () => { await addAdminToTournament(u.id); setAdminDialogOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold text-sm flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <UserPlus className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <VolunteersListDrawer
        open={volunteersDrawerOpen}
        onOpenChange={setVolunteersDrawerOpen}
        volunteers={volunteersList}
        tournamentName={tournament.name}
      />
    </div>
  );
}
