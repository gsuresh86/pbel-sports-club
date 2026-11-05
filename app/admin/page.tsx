'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  collectionGroup,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  ArrowRight,
  Calendar,
  Clock,
  Play,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { adminTournamentMatchPath } from '@/lib/firestore-paths';
import { canReviewTestimonials } from '@/lib/permissions';
import { fetchTournaments } from '@/lib/tournament-api';
import type { Tournament, User } from '@/types';

type AttentionTone = 'rose' | 'amber' | 'sky' | 'emerald';

interface AttentionItem {
  id: string;
  tone: AttentionTone;
  label: string;
  title: string;
  detail?: string;
  href: string;
}

interface LiveMatchRow {
  id: string;
  tournamentId: string;
  tournamentName: string;
  label: string;
  href: string;
}

interface RecentItem {
  id: string;
  href: string;
  title: string;
  detail: string;
  time?: Date;
  tone: AttentionTone;
}

interface DashboardData {
  tournaments: Tournament[];
  users: User[];
  pendingLeads: Array<{ id: string; name: string; tournamentName?: string; sport?: string; registeredAt?: Date }>;
  pendingTestimonials: number;
  pendingRegsByTournament: Record<string, number>;
  liveMatches: LiveMatchRow[];
  recentItems: RecentItem[];
}

const emptyData: DashboardData = {
  tournaments: [],
  users: [],
  pendingLeads: [],
  pendingTestimonials: 0,
  pendingRegsByTournament: {},
  liveMatches: [],
  recentItems: [],
};

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return undefined;
}

function daysUntil(date: Date): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date?: Date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function relativeTime(date?: Date) {
  if (!date) return 'Recently';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(Math.abs(diffMs) / 60000);
  if (minutes < 60) return diffMs >= 0 ? `${minutes}m ago` : `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return diffMs >= 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return diffMs >= 0 ? `${days}d ago` : `in ${days}d`;
}

function statusBadgeClass(status: string) {
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
}

function toneDot(tone: AttentionTone) {
  switch (tone) {
    case 'rose':
      return 'bg-rose-500';
    case 'amber':
      return 'bg-amber-500';
    case 'sky':
      return 'bg-sky-500';
    default:
      return 'bg-emerald-500';
  }
}

async function loadDashboard(canReview: boolean): Promise<DashboardData> {
  const [tournaments, usersSnap, leadsSnap, testimonialsSnap, liveMatchesSnap] = await Promise.all([
    fetchTournaments(),
    getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50))),
    getDocs(query(collection(db, 'tournamentLeads'), orderBy('registeredAt', 'desc'), limit(40))),
    canReview ? getDocs(collection(db, 'testimonials')) : Promise.resolve(null),
    getDocs(query(collectionGroup(db, 'matches'), where('status', '==', 'live'), limit(20))).catch(() => null),
  ]);

  const users = usersSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: toDate(docSnap.data().createdAt),
  })) as User[];

  const pendingLeads = leadsSnap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: String(data.name ?? 'Lead'),
        tournamentName: typeof data.tournamentName === 'string' ? data.tournamentName : undefined,
        sport: typeof data.sport === 'string' ? data.sport : undefined,
        status: data.status,
        registeredAt: toDate(data.registeredAt),
      };
    })
    .filter((lead) => lead.status === 'pending');

  const pendingTestimonials = testimonialsSnap
    ? testimonialsSnap.docs.filter((docSnap) => docSnap.data().published !== true).length
    : 0;

  const tournamentNameById = Object.fromEntries(tournaments.map((tournament) => [tournament.id, tournament.name]));
  const liveMatches: LiveMatchRow[] = (liveMatchesSnap?.docs ?? []).map((docSnap) => {
    const data = docSnap.data();
    const tournamentId = docSnap.ref.parent.parent?.id || String(data.tournamentId ?? '');
    const player1 = String(data.player1Name ?? 'TBD');
    const player2 = String(data.player2Name ?? 'TBD');
    return {
      id: docSnap.id,
      tournamentId,
      tournamentName: tournamentNameById[tournamentId] ?? 'Tournament',
      label: `${player1} vs ${player2}`,
      href: tournamentId ? adminTournamentMatchPath(tournamentId, docSnap.id) : '/admin/matches',
    };
  });

  const activeTournaments = tournaments.filter(
    (tournament) => tournament.status === 'upcoming' || tournament.status === 'ongoing'
  );
  const pendingRegsByTournament: Record<string, number> = {};
  await Promise.all(
    activeTournaments.map(async (tournament) => {
      try {
        const countSnap = await getCountFromServer(
          query(
            collection(db, 'tournaments', tournament.id, 'registrations'),
            where('registrationStatus', '==', 'pending')
          )
        );
        pendingRegsByTournament[tournament.id] = countSnap.data().count;
      } catch {
        pendingRegsByTournament[tournament.id] = 0;
      }
    })
  );

  const recentItems: RecentItem[] = [
    ...tournaments.slice(0, 4).map((tournament) => ({
      id: `tournament-${tournament.id}`,
      href: `/admin/tournaments/${tournament.id}/overview`,
      title: tournament.name,
      detail: 'Tournament created',
      time: tournament.createdAt,
      tone: 'emerald' as const,
    })),
    ...leadsSnap.docs.slice(0, 4).map((docSnap) => {
      const data = docSnap.data();
      return {
        id: `lead-${docSnap.id}`,
        href: `/admin/leads?q=${encodeURIComponent(String(data.email || data.name || ''))}`,
        title: String(data.name ?? 'New lead'),
        detail: `Lead · ${data.status ?? 'pending'}`,
        time: toDate(data.registeredAt),
        tone: 'sky' as const,
      };
    }),
    ...users.slice(0, 3).map((staff) => ({
      id: `user-${staff.id}`,
      href: `/admin/users?q=${encodeURIComponent(staff.email || staff.name)}`,
      title: staff.name,
      detail: `User · ${staff.role}`,
      time: staff.createdAt,
      tone: 'amber' as const,
    })),
  ]
    .sort((a, b) => (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0))
    .slice(0, 8);

  return {
    tournaments,
    users,
    pendingLeads,
    pendingTestimonials,
    pendingRegsByTournament,
    liveMatches,
    recentItems,
  };
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loadingStats, setLoadingStats] = useState(true);

  const canReview = canReviewTestimonials(user);

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && user.role !== 'super-admin'))) {
      router.push('/login');
      return;
    }
    if (!loading && user) {
      loadDashboard(canReview)
        .then(setData)
        .catch((error) => {
          console.error('Error fetching dashboard stats:', error);
          setData(emptyData);
        })
        .finally(() => setLoadingStats(false));
    }
  }, [user, loading, router, canReview]);

  const stats = useMemo(() => {
    const ongoing = data.tournaments.filter((tournament) => tournament.status === 'ongoing').length;
    const upcoming = data.tournaments.filter((tournament) => tournament.status === 'upcoming').length;
    const registrationOpen = data.tournaments.filter((tournament) => tournament.registrationOpen).length;
    const pendingRegs = Object.values(data.pendingRegsByTournament).reduce((sum, count) => sum + count, 0);
    return {
      ongoing,
      upcoming,
      registrationOpen,
      pendingRegs,
      pendingLeads: data.pendingLeads.length,
      pendingTestimonials: data.pendingTestimonials,
      liveMatches: data.liveMatches.length,
      staff: data.users.length,
    };
  }, [data]);

  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = [];

    for (const match of data.liveMatches) {
      items.push({
        id: `live-${match.id}`,
        tone: 'rose',
        label: 'Live',
        title: match.label,
        detail: match.tournamentName,
        href: match.href,
      });
    }

    for (const lead of data.pendingLeads.slice(0, 4)) {
      items.push({
        id: `lead-${lead.id}`,
        tone: 'amber',
        label: 'Lead',
        title: lead.name,
        detail: lead.tournamentName || lead.sport?.replace('-', ' '),
        href: `/admin/leads?q=${encodeURIComponent(lead.name)}`,
      });
    }

    if (canReview && data.pendingTestimonials > 0) {
      items.push({
        id: 'testimonials-pending',
        tone: 'amber',
        label: 'Review',
        title: `${data.pendingTestimonials} testimonial${data.pendingTestimonials === 1 ? '' : 's'} to publish`,
        href: '/admin/testimonials?q=',
      });
    }

    for (const tournament of data.tournaments) {
      const pending = data.pendingRegsByTournament[tournament.id] ?? 0;
      if (pending > 0) {
        items.push({
          id: `pending-reg-${tournament.id}`,
          tone: 'sky',
          label: 'Registrations',
          title: `${pending} pending in ${tournament.name}`,
          href: `/admin/tournaments/${tournament.id}/participants`,
        });
      }
    }

    for (const tournament of data.tournaments) {
      if (!tournament.registrationOpen || !tournament.registrationDeadline) continue;
      const days = daysUntil(new Date(tournament.registrationDeadline));
      if (days < 0 || days > 7) continue;
      items.push({
        id: `deadline-${tournament.id}`,
        tone: days <= 2 ? 'rose' : 'amber',
        label: 'Deadline',
        title: tournament.name,
        detail: days === 0 ? 'Closes today' : `Closes in ${days} day${days === 1 ? '' : 's'}`,
        href: `/admin/tournaments/${tournament.id}/overview`,
      });
    }

    return items.slice(0, 8);
  }, [canReview, data]);

  const activeTournaments = useMemo(
    () =>
      data.tournaments
        .filter((tournament) => tournament.status === 'upcoming' || tournament.status === 'ongoing')
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [data.tournaments]
  );

  if (loading || !user || (user.role !== 'admin' && user.role !== 'super-admin')) {
    return null;
  }

  const kpiCards = [
    { label: 'Ongoing', value: stats.ongoing, href: '/admin/tournaments', hint: `${stats.upcoming} upcoming` },
    { label: 'Reg. open', value: stats.registrationOpen, href: '/admin/tournaments', hint: 'accepting entries' },
    { label: 'Pending regs', value: stats.pendingRegs, href: '/admin/tournaments', hint: 'need review' },
    { label: 'Leads', value: stats.pendingLeads, href: '/admin/leads', hint: 'awaiting decision' },
    ...(canReview
      ? [{ label: 'Testimonials', value: stats.pendingTestimonials, href: '/admin/testimonials', hint: 'to publish' }]
      : [{ label: 'Staff', value: stats.staff, href: '/admin/users', hint: 'admin users' }]),
    { label: 'Live matches', value: stats.liveMatches, href: '/admin/tournaments', hint: stats.liveMatches ? 'in play' : 'none now' },
  ];

  return (
    <AdminLayout moduleName="Dashboard">
      <div className="min-h-full bg-[#f4f5f7] p-4 lg:p-6">
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
          {kpiCards.map((card) => (
            <Link key={card.label} href={card.href}>
              <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-3 hover:border-slate-300 transition-colors">
                <CardContent className="px-4">
                  <p className="text-xs text-slate-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    {loadingStats ? '…' : card.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{card.hint}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-slate-100 space-y-0 grid-rows-1">
              <CardTitle className="text-sm font-semibold text-slate-900">Needs attention</CardTitle>
              <span className="text-xs text-slate-400">{attentionItems.length}</span>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loadingStats ? (
                <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
              ) : attentionItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">All clear</p>
              ) : (
                <ul>
                  {attentionItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot(item.tone)}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            {item.label}
                          </span>
                          <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                          {item.detail && (
                            <span className="block truncate text-xs text-slate-500">{item.detail}</span>
                          )}
                        </span>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden xl:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-slate-100 space-y-0 grid-rows-1">
              <CardTitle className="text-sm font-semibold text-slate-900">Active tournaments</CardTitle>
              <div className="flex items-center gap-3">
                <Link href="/admin/tournaments" className="text-xs font-medium text-slate-500 hover:text-slate-800">
                  View all
                </Link>
                <Button
                  onClick={() => router.push('/admin/tournaments?create=1')}
                  className="h-8 rounded-lg bg-slate-900 px-2.5 text-xs text-white hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loadingStats ? (
                <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
              ) : activeTournaments.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No upcoming or live tournaments</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableHead className="h-9 pl-4 text-xs font-medium text-slate-400">Tournament</TableHead>
                      <TableHead className="h-9 text-xs font-medium text-slate-400">Dates</TableHead>
                      <TableHead className="h-9 text-xs font-medium text-slate-400">Status</TableHead>
                      <TableHead className="h-9 pr-4 text-xs font-medium text-slate-400">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeTournaments.map((tournament) => (
                      <TableRow
                        key={tournament.id}
                        className="border-slate-50 cursor-pointer hover:bg-slate-50/80"
                        onClick={() => router.push(`/admin/tournaments/${tournament.id}/overview`)}
                      >
                        <TableCell className="pl-4 py-2.5">
                          <p className="text-sm font-medium text-slate-900 truncate max-w-[220px]">{tournament.name}</p>
                          <p className="text-xs text-slate-400 capitalize">
                            {tournament.sport?.replace('-', ' ')}
                            {tournament.venue ? ` · ${tournament.venue}` : ''}
                          </p>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge className={`rounded-full border capitalize ${statusBadgeClass(tournament.status)}`}>
                            {tournament.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4 py-2.5 text-sm text-slate-700">
                          {data.pendingRegsByTournament[tournament.id] || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-slate-100 space-y-0 grid-rows-1">
              <CardTitle className="text-sm font-semibold text-slate-900">Live now</CardTitle>
              {data.liveMatches.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                  <Play className="h-3 w-3" />
                  {data.liveMatches.length}
                </span>
              )}
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loadingStats ? (
                <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
              ) : data.liveMatches.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No live matches</p>
              ) : (
                <ul>
                  {data.liveMatches.map((match) => (
                    <li key={match.id}>
                      <Link
                        href={match.href}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{match.label}</span>
                          <span className="block truncate text-xs text-slate-500">{match.tournamentName}</span>
                        </span>
                        <Badge className="rounded-full border-rose-100 bg-rose-50 text-rose-700">Live</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="px-4 py-3 border-b border-slate-100 space-y-0 grid-rows-1">
              <CardTitle className="text-sm font-semibold text-slate-900">Recent</CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loadingStats ? (
                <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
              ) : data.recentItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No recent activity</p>
              ) : (
                <ul>
                  {data.recentItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot(item.tone)}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                          <span className="block truncate text-xs text-slate-500">{item.detail}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          {relativeTime(item.time)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
