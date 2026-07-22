'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User } from '@/types';
import { dedupeByNamePhone, parsePaymentRecipient, cn } from '@/lib/utils';
import {
  Users,
  Clock,
  Activity,
  TrendingUp,
  UserCheck,
  BarChart3,
  HandHeart,
  Home,
  Shirt,
  IndianRupee,
  ChevronDown,
  Users2,
  UserPlus,
  Target,
  X,
  PieChart,
  Trophy,
  ArrowRight,
  MapPin,
  Calendar,
} from 'lucide-react';
import VolunteersListDrawer from '@/components/admin/VolunteersListDrawer';
import { useTournamentPageGate } from '@/hooks/use-tournament-page-gate';

const TSHIRT_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function OverviewPage() {
  const router = useRouter();
  const { user, tournamentId, queriesEnabled } = useTournamentPageGate('overview');

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: registrationsData = [] } = useTournamentRegistrations(tournamentId, {
    enabled: queriesEnabled,
  });
  const { data: matchesData = [] } = useTournamentMatches(tournamentId, {
    enabled: queriesEnabled,
  });

  const tournament = tournamentData ?? null;
  const participants = registrationsData;
  const matches = matchesData;

  const isFullAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [refereeDialogOpen, setRefereeDialogOpen] = useState(false);
  const [tournamentAdmins, setTournamentAdmins] = useState<User[]>([]);
  const [referees, setReferees] = useState<User[]>([]);
  const [volunteersDrawerOpen, setVolunteersDrawerOpen] = useState(false);
  const [insightScope, setInsightScope] = useState<'charts' | 'timeline'>('charts');

  useEffect(() => {
    if (!isFullAdmin) return;
    getDocs(query(collection(db, 'users'), where('role', '==', 'tournament-admin'))).then(
      (snap) => {
        setTournamentAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
      }
    );
    getDocs(query(collection(db, 'users'), where('role', '==', 'referee'))).then((snap) => {
      setReferees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
    });
  }, [isFullAdmin]);

  const refreshAdmins = () => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'tournament-admin'))).then(
      (snap) => {
        setTournamentAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
      }
    );
  };

  const refreshReferees = () => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'referee'))).then((snap) => {
      setReferees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
    });
  };

  const addAdminToTournament = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), {
      assignedTournaments: arrayUnion(tournamentId),
      updatedAt: new Date(),
    });
    refreshAdmins();
  };

  const removeAdminFromTournament = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), {
      assignedTournaments: arrayRemove(tournamentId),
      updatedAt: new Date(),
    });
    refreshAdmins();
  };

  const assignedAdmins = tournamentAdmins.filter((u) =>
    u.assignedTournaments?.includes(tournamentId)
  );
  const unassignedAdmins = tournamentAdmins.filter(
    (u) => !u.assignedTournaments?.includes(tournamentId)
  );
  const assignedReferees = referees.filter((u) =>
    u.assignedTournaments?.includes(tournamentId)
  );
  const unassignedReferees = referees.filter(
    (u) => !u.assignedTournaments?.includes(tournamentId)
  );

  const addRefereeToTournament = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), {
      assignedTournaments: arrayUnion(tournamentId),
      updatedAt: new Date(),
    });
    refreshReferees();
  };

  const removeRefereeFromTournament = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), {
      assignedTournaments: arrayRemove(tournamentId),
      updatedAt: new Date(),
    });
    refreshReferees();
  };

  const analytics = useMemo(() => {
    const catMap = new Map<
      string,
      { total: number; approved: number; pending: number; rejected: number }
    >();
    participants.forEach((p) => {
      if (!catMap.has(p.selectedCategory))
        catMap.set(p.selectedCategory, { total: 0, approved: 0, pending: 0, rejected: 0 });
      const e = catMap.get(p.selectedCategory)!;
      e.total++;
      e[p.registrationStatus as 'approved' | 'pending' | 'rejected']++;
    });
    const categories = Array.from(catMap.entries()).sort((a, b) => b[1].total - a[1].total);

    const gender = { male: 0, female: 0, other: 0 };
    participants.forEach((p) => {
      gender[p.gender as keyof typeof gender] = (gender[p.gender as keyof typeof gender] || 0) + 1;
    });

    const level = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
    participants.forEach((p) => {
      level[p.expertiseLevel as keyof typeof level] =
        (level[p.expertiseLevel as keyof typeof level] || 0) + 1;
    });

    const paid = participants.filter((p) => p.paymentStatus === 'paid');
    const totalRevenue = paid.reduce((sum, p) => sum + (p.paymentAmount ?? 0), 0);
    const pendingPayment = participants.filter((p) => p.paymentStatus === 'pending').length;
    const pendingRegistrations = participants.filter((p) => p.registrationStatus === 'pending');
    const pendingRegistrationCount = pendingRegistrations.length;
    const expectedFromPendingRegistrations = pendingRegistrations.reduce(
      (sum, p) => sum + (p.paymentAmount ?? 0),
      0
    );

    const volunteers = dedupeByNamePhone(
      participants.filter((p) => p.isVolunteer === true)
    ).sort((a, b) => a.name.localeCompare(b.name));
    const volunteerCount = volunteers.length;
    const residentCount = participants.filter((p) => p.isResident === true).length;
    const nonResidentCount = participants.filter((p) => p.isResident === false).length;

    const dateMap = new Map<string, number>();
    participants.forEach((p) => {
      const d = new Date(p.registeredAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      });
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
    () =>
      dedupeByNamePhone(participants.filter((p) => p.isVolunteer === true)).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [participants]
  );

  const totalParticipants = participants.length;
  const approvedParticipants = participants.filter(
    (p) => p.registrationStatus === 'approved'
  ).length;
  const pendingParticipants = participants.filter(
    (p) => p.registrationStatus === 'pending'
  ).length;
  const paidParticipants = participants.filter((p) => p.paymentStatus === 'paid').length;
  const totalMatches = matches.length;
  const completedMatches = matches.filter((m) => m.status === 'completed').length;
  const liveMatches = matches.filter((m) => m.status === 'live').length;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'ongoing':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'completed':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  if (!tournament) return null;

  const fillPct = tournament.maxParticipants
    ? Math.round((totalParticipants / tournament.maxParticipants) * 100)
    : null;

  return (
    <div className="-mx-4 -my-4 sm:-mx-6 sm:-my-6 min-h-full bg-[#f4f5f7] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Dashboard Overview
            </h1>
            <Badge
              className={`rounded-full border capitalize ${getStatusBadgeClass(tournament.status)}`}
            >
              {tournament.status}
            </Badge>
            {tournament.registrationOpen && (
              <Badge className="rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
                Registration Open
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(tournament.startDate)}
              <ArrowRight className="h-3 w-3 text-slate-300" />
              {formatDate(tournament.endDate)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {tournament.venue}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          className="h-10 rounded-xl border-slate-200 bg-white hover:bg-slate-50"
          onClick={() => router.push(`/admin/tournaments/${tournamentId}/participants`)}
        >
          <Users className="h-4 w-4 mr-1.5" />
          View Participants
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-5">
          <CardContent className="px-5">
            <p className="text-sm text-slate-500">Participants</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {totalParticipants}
                {tournament.maxParticipants ? (
                  <span className="text-lg font-semibold text-slate-400">
                    /{tournament.maxParticipants}
                  </span>
                ) : null}
              </p>
              {fillPct !== null && (
                <span className="mb-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {fillPct}% filled
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {approvedParticipants} approved · {pendingParticipants} pending
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-5">
          <CardContent className="px-5">
            <p className="text-sm text-slate-500">Revenue Collected</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatCurrency(analytics.totalRevenue)}
              </p>
              <span className="mb-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {analytics.paidCount} paid
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {paidParticipants} of {totalParticipants} participants
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-5 bg-amber-50/40 border-amber-100">
          <CardContent className="px-5">
            <p className="text-sm text-amber-700/80">Expected (Pending)</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatCurrency(analytics.expectedFromPendingRegistrations)}
              </p>
              {analytics.pendingRegistrationCount > 0 && (
                <span className="mb-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {analytics.pendingRegistrationCount} regs
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-amber-700/70">
              {analytics.pendingPayment} payment{analytics.pendingPayment === 1 ? '' : 's'} pending
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-5">
          <CardContent className="px-5">
            <p className="text-sm text-slate-500">Matches</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {totalMatches}
              </p>
              {liveMatches > 0 ? (
                <span className="mb-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                  {liveMatches} live
                </span>
              ) : (
                <span className="mb-1 text-xs text-slate-400">{completedMatches} done</span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {completedMatches} completed · {liveMatches} live
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Approved',
            value: String(approvedParticipants),
            icon: UserCheck,
            tint: 'text-emerald-600',
          },
          {
            label: 'Pending regs',
            value: String(pendingParticipants),
            icon: Clock,
            tint: 'text-amber-600',
          },
          {
            label: 'Pay pending',
            value: String(analytics.pendingPayment),
            icon: Clock,
            tint: 'text-orange-500',
          },
          {
            label: 'Volunteers',
            value: String(analytics.volunteerCount),
            icon: HandHeart,
            tint: 'text-rose-500',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3"
          >
            <kpi.icon className={cn('h-4 w-4 shrink-0', kpi.tint)} />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">{kpi.label}</p>
              <p className="text-lg font-bold tabular-nums text-slate-900 leading-tight">
                {kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Collections + community */}
      <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
        <CardContent className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <button
              type="button"
              onClick={() => setCollectionsOpen((o) => !o)}
              aria-expanded={collectionsOpen}
              className="flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              <IndianRupee className="h-4 w-4" /> Collections by recipient
              <ChevronDown
                className={`h-4 w-4 transition-transform ${collectionsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {collectionsOpen &&
              (revenueByReceiver.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {revenueByReceiver.map((receiver) => (
                    <span
                      key={`${receiver.name}-${receiver.number}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                      title={receiver.number || undefined}
                    >
                      <span className="font-medium text-slate-800">{receiver.name}</span>
                      <span className="tabular-nums text-slate-600">
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(receiver.amount)}
                        </span>
                        <span className="text-slate-400"> · {receiver.count} paid</span>
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-400">No payments collected yet.</span>
              ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 tabular-nums">
                {paidParticipants} of {totalParticipants} paid
              </span>
              <button
                type="button"
                onClick={() => analytics.volunteerCount > 0 && setVolunteersDrawerOpen(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm',
                  analytics.volunteerCount > 0
                    ? 'bg-rose-50 border-rose-100 hover:bg-rose-100 cursor-pointer'
                    : 'bg-white border-slate-200 text-slate-400'
                )}
              >
                <HandHeart className="h-4 w-4 text-rose-500" />
                <span className="font-medium">{analytics.volunteerCount}</span> volunteers
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                <Home className="h-4 w-4 text-sky-500" />
                <span className="font-medium">{analytics.residentCount}</span> residents
                <span className="text-slate-400">· {analytics.nonResidentCount} other</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff: Referees + Admins */}
      {isFullAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Target className="h-4 w-4 text-slate-400" />
                    Referees
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Users who can score matches
                  </p>
                </div>
                {unassignedReferees.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-slate-200"
                    onClick={() => setRefereeDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 py-4">
              {assignedReferees.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">
                  No referees assigned yet.{' '}
                  {unassignedReferees.length > 0 && (
                    <button
                      className="underline text-slate-700"
                      onClick={() => setRefereeDialogOpen(true)}
                    >
                      Add one
                    </button>
                  )}
                  {unassignedReferees.length === 0 && 'Create referee users first.'}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedReferees.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 text-sm"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-semibold text-xs flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-emerald-900 leading-tight truncate max-w-[120px]">
                          {u.name}
                        </p>
                        <p className="text-[10px] text-emerald-600 truncate max-w-[120px]">
                          {u.email}
                        </p>
                      </div>
                      <button
                        onClick={() => removeRefereeFromTournament(u.id)}
                        className="ml-1 text-emerald-400 hover:text-rose-500 transition-colors flex-shrink-0"
                        title="Remove referee"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-slate-400" />
                    Tournament Admins
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Users who can manage this tournament
                  </p>
                </div>
                {unassignedAdmins.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-slate-200"
                    onClick={() => setAdminDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 py-4">
              {assignedAdmins.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">
                  No admins assigned yet.{' '}
                  {unassignedAdmins.length > 0 && (
                    <button
                      className="underline text-slate-700"
                      onClick={() => setAdminDialogOpen(true)}
                    >
                      Add one
                    </button>
                  )}
                  {unassignedAdmins.length === 0 && 'Create tournament-admin users first.'}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedAdmins.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-full px-3 py-1.5 text-sm"
                    >
                      <div className="w-6 h-6 rounded-full bg-sky-200 flex items-center justify-center text-sky-800 font-semibold text-xs flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sky-900 leading-tight truncate max-w-[120px]">
                          {u.name}
                        </p>
                        <p className="text-[10px] text-sky-600 truncate max-w-[120px]">
                          {u.email}
                        </p>
                      </div>
                      <button
                        onClick={() => removeAdminFromTournament(u.id)}
                        className="ml-1 text-sky-400 hover:text-rose-500 transition-colors flex-shrink-0"
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
        </div>
      )}

      {/* Insights */}
      {participants.length === 0 ? (
        <Card className="rounded-2xl border-slate-200/80 shadow-none">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              No registration insights yet
            </h3>
            <p className="text-sm text-slate-500">
              Charts and breakdowns will appear once registrations come in.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Registration Insights</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {participants.length} registrations across {analytics.categories.length} categor
                {analytics.categories.length === 1 ? 'y' : 'ies'}
              </p>
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 self-start">
              <button
                type="button"
                onClick={() => setInsightScope('charts')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  insightScope === 'charts'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Charts
              </button>
              <button
                type="button"
                onClick={() => setInsightScope('timeline')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  insightScope === 'timeline'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Timeline
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {insightScope === 'charts' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* By Category */}
                  <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">By Category</h3>
                    </div>
                    {analytics.categories.length === 0 ? (
                      <p className="text-sm text-slate-400">No category data yet.</p>
                    ) : (
                      (() => {
                        const maxTotal = Math.max(
                          ...analytics.categories.map(([, c]) => c.total)
                        );
                        const CHART_H = 140;
                        const abbrev = (cat: string) =>
                          cat
                            .replace('girls-under', 'G-U')
                            .replace('boys-under', 'B-U')
                            .replace('womens-', 'W-')
                            .replace('mens-', 'M-')
                            .replace('mixed-doubles', 'Mixed')
                            .replace('open-team', 'Open')
                            .replace('kids-team-u', 'Kids-U')
                            .replace('-', ' ');
                        return (
                          <>
                            <div className="overflow-x-auto">
                              <div
                                className="flex items-end gap-2 min-w-max pb-1"
                                style={{ height: CHART_H + 32 }}
                              >
                                {analytics.categories.map(([cat, counts]) => {
                                  const colH = maxTotal
                                    ? Math.round((counts.total / maxTotal) * CHART_H)
                                    : 4;
                                  const approvedH = counts.total
                                    ? Math.round((counts.approved / counts.total) * colH)
                                    : 0;
                                  const pendingH = counts.total
                                    ? Math.round((counts.pending / counts.total) * colH)
                                    : 0;
                                  const rejectedH = colH - approvedH - pendingH;
                                  return (
                                    <div
                                      key={cat}
                                      className="flex flex-col items-center gap-1 w-14 flex-shrink-0"
                                      title={cat.replace(/-/g, ' ')}
                                    >
                                      <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                                        {counts.total}
                                      </span>
                                      <div
                                        className="w-10 flex flex-col-reverse overflow-hidden rounded-t"
                                        style={{ height: colH, minHeight: 4 }}
                                      >
                                        <div
                                          className="w-full bg-emerald-500 transition-all"
                                          style={{ height: approvedH }}
                                        />
                                        <div
                                          className="w-full bg-amber-400 transition-all"
                                          style={{ height: pendingH }}
                                        />
                                        <div
                                          className="w-full bg-rose-400 transition-all"
                                          style={{ height: rejectedH }}
                                        />
                                      </div>
                                      <span className="text-[9px] text-slate-400 text-center leading-tight capitalize w-full truncate">
                                        {abbrev(cat)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-2">
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                                approved
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-sm bg-amber-400" />
                                pending
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-sm bg-rose-400" />
                                rejected
                              </span>
                            </div>
                          </>
                        );
                      })()
                    )}
                  </div>

                  {/* T-Shirt Sizes */}
                  <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shirt className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">T-Shirt Sizes</h3>
                      <span className="text-xs text-slate-400 ml-auto">
                        {analytics.totalTshirts} shirts
                      </span>
                    </div>
                    {analytics.tshirtSizes.length === 0 ? (
                      <p className="text-sm text-slate-400">No t-shirt size data yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {analytics.tshirtSizes.map(([size, count]) => {
                          const pct = analytics.totalTshirts
                            ? Math.round((count / analytics.totalTshirts) * 100)
                            : 0;
                          const barColors: Record<string, string> = {
                            XS: 'bg-slate-400',
                            S: 'bg-sky-400',
                            M: 'bg-teal-500',
                            L: 'bg-sky-600',
                            XL: 'bg-teal-600',
                            XXL: 'bg-amber-500',
                            XXXL: 'bg-rose-500',
                          };
                          const barColor =
                            barColors[size] ??
                            (size === 'Not specified' ? 'bg-slate-300' : 'bg-amber-500');
                          return (
                            <div key={size} className="flex items-center gap-3">
                              <span
                                className="text-sm w-24 flex-shrink-0 text-slate-600 truncate"
                                title={size}
                              >
                                {size}
                              </span>
                              <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                                <div
                                  className={`h-full ${barColor} transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold text-slate-700">
                                  {count}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400 w-8 text-right">
                                {pct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <PieChart className="h-3.5 w-3.5 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">Gender Split</h3>
                    </div>
                    <div className="space-y-1.5">
                      {(['male', 'female', 'other'] as const).map((g) => {
                        const count = analytics.gender[g];
                        const pct = participants.length
                          ? Math.round((count / participants.length) * 100)
                          : 0;
                        const colors = {
                          male: 'bg-sky-500',
                          female: 'bg-rose-400',
                          other: 'bg-slate-400',
                        };
                        return (
                          <div key={g} className="flex items-center gap-2">
                            <span className="text-xs capitalize w-12 flex-shrink-0 text-slate-600">
                              {g}
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
                              <div
                                className={`h-full ${colors[g]} transition-all`}
                                style={{ width: `${pct}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[11px] font-semibold text-slate-700">
                                {count}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 w-7 text-right tabular-nums">
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">Expertise Level</h3>
                    </div>
                    <div className="space-y-1.5">
                      {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((l) => {
                        const count = analytics.level[l];
                        const pct = participants.length
                          ? Math.round((count / participants.length) * 100)
                          : 0;
                        const colors = {
                          beginner: 'bg-emerald-400',
                          intermediate: 'bg-sky-400',
                          advanced: 'bg-teal-500',
                          expert: 'bg-amber-500',
                        };
                        return (
                          <div key={l} className="flex items-center gap-2">
                            <span
                              className="text-xs capitalize w-16 flex-shrink-0 text-slate-600 truncate"
                              title={l}
                            >
                              {l}
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
                              <div
                                className={`h-full ${colors[l]} transition-all`}
                                style={{ width: `${pct}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[11px] font-semibold text-slate-700">
                                {count}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 w-7 text-right tabular-nums">
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : analytics.timeline.length > 1 ? (
              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Daily Registrations</h3>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-2 min-w-max h-24 px-0.5">
                    {(() => {
                      const maxDay = Math.max(...analytics.timeline.map(([, c]) => c));
                      return analytics.timeline.map(([date, count]) => (
                        <div key={date} className="flex flex-col items-center gap-1 w-10">
                          <span className="text-xs font-semibold text-slate-700">{count}</span>
                          <div
                            className="w-8 bg-sky-500 rounded-t transition-all hover:bg-sky-600"
                            style={{
                              height: `${maxDay ? (count / maxDay) * 72 : 4}px`,
                              minHeight: '4px',
                            }}
                            title={`${date}: ${count} registrations`}
                          />
                          <span className="text-[9px] text-slate-400 text-center leading-tight">
                            {date}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                Not enough daily data for a timeline yet.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Add Referee Dialog */}
      {isFullAdmin && (
        <Dialog open={refereeDialogOpen} onOpenChange={setRefereeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Referee</DialogTitle>
              <DialogDescription>
                Select a referee to score matches for this tournament.
              </DialogDescription>
            </DialogHeader>
            {unassignedReferees.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                All referee users are already assigned.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto py-2">
                {unassignedReferees.map((u) => (
                  <button
                    key={u.id}
                    onClick={async () => {
                      await addRefereeToTournament(u.id);
                      setRefereeDialogOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold text-sm flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <UserPlus className="h-4 w-4 text-slate-400 ml-auto flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Add Admin Dialog */}
      {isFullAdmin && (
        <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Tournament Admin</DialogTitle>
              <DialogDescription>
                Select a user to give access to this tournament.
              </DialogDescription>
            </DialogHeader>
            {unassignedAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                All tournament-admin users are already assigned.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto py-2">
                {unassignedAdmins.map((u) => (
                  <button
                    key={u.id}
                    onClick={async () => {
                      await addAdminToTournament(u.id);
                      setAdminDialogOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-sky-50 hover:border-sky-200 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold text-sm flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <UserPlus className="h-4 w-4 text-slate-400 ml-auto flex-shrink-0" />
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
