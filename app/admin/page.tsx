'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDoc,
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
  Eye,
  Play,
  Plus,
  Users,
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
import {
  SITE_ANALYTICS_COLLECTION,
  SITE_ANALYTICS_SUMMARY_ID,
  dailyAnalyticsDocId,
  emptySiteVisitStats,
  lastNDateKeys,
  type SiteVisitStats,
} from '@/lib/site-analytics';
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
  siteVisits: SiteVisitStats;
}

const emptyData: DashboardData = {
  tournaments: [],
  users: [],
  pendingLeads: [],
  pendingTestimonials: 0,
  pendingRegsByTournament: {},
  liveMatches: [],
  recentItems: [],
  siteVisits: emptySiteVisitStats,
};

async function loadSiteVisitStats(): Promise<SiteVisitStats> {
  try {
    const weekKeys = lastNDateKeys(7);
    const [summarySnap, ...dailySnaps] = await Promise.all([
      getDoc(doc(db, SITE_ANALYTICS_COLLECTION, SITE_ANALYTICS_SUMMARY_ID)),
      ...weekKeys.map((key) => getDoc(doc(db, SITE_ANALYTICS_COLLECTION, dailyAnalyticsDocId(key)))),
    ]);

    const summary = summarySnap.data() || {};
    let weekPageViews = 0;
    let weekUniqueVisitors = 0;
    let todayPageViews = 0;
    let todayUniqueVisitors = 0;

    dailySnaps.forEach((snap, index) => {
      const data = snap.data() || {};
      const pageViews = Number(data.pageViews) || 0;
      const uniqueVisitors = Number(data.uniqueVisitors) || 0;
      weekPageViews += pageViews;
      weekUniqueVisitors += uniqueVisitors;
      if (index === 0) {
        todayPageViews = pageViews;
        todayUniqueVisitors = uniqueVisitors;
      }
    });

    return {
      todayPageViews,
      todayUniqueVisitors,
      weekPageViews,
      weekUniqueVisitors,
      totalPageViews: Number(summary.totalPageViews) || 0,
      totalUniqueVisitors: Number(summary.totalUniqueVisitors) || 0,
    };
  } catch (error) {
    console.warn('Could not load site visit stats:', error);
    return emptySiteVisitStats;
  }
}

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
      return 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800';
    case 'ongoing':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    case 'completed':
      return 'bg-muted text-muted-foreground border-border';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
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

async function loadDashboard(canReview: boolean, includeSiteVisits: boolean): Promise<DashboardData> {
  const [tournaments, usersSnap, leadsSnap, testimonialsSnap, liveMatchesSnap, siteVisits] = await Promise.all([
    fetchTournaments(),
    getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50))),
    getDocs(query(collection(db, 'tournamentLeads'), orderBy('registeredAt', 'desc'), limit(40))),
    canReview ? getDocs(collection(db, 'testimonials')) : Promise.resolve(null),
    getDocs(query(collectionGroup(db, 'matches'), where('status', '==', 'live'), limit(20))).catch(() => null),
    includeSiteVisits ? loadSiteVisitStats() : Promise.resolve(emptySiteVisitStats),
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
    siteVisits,
  };
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loadingStats, setLoadingStats] = useState(true);

  const canReview = canReviewTestimonials(user);
  const isSuperAdmin = user?.role === 'super-admin';

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && user.role !== 'super-admin'))) {
      router.push('/login');
      return;
    }
    if (!loading && user) {
      loadDashboard(canReview, user.role === 'super-admin')
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

    for (const tournament of data.tournaments) {
      if (tournament.approvalStatus !== 'pending') continue;
      items.push({
        id: `review-${tournament.id}`,
        tone: 'amber',
        label: 'Review',
        title: tournament.name,
        detail: 'Organizer submission',
        href: '/admin/reviews',
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
        .filter((tournament) =>
          (tournament.status === 'upcoming' || tournament.status === 'ongoing')
          && tournament.approvalStatus !== 'pending'
          && tournament.approvalStatus !== 'rejected',
        )
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

  const visitCards = [
    {
      label: 'Visits today',
      value: data.siteVisits.todayPageViews,
      hint: `${data.siteVisits.todayUniqueVisitors} unique`,
      icon: Eye,
    },
    {
      label: 'Visits (7 days)',
      value: data.siteVisits.weekPageViews,
      hint: `${data.siteVisits.weekUniqueVisitors} unique`,
      icon: Eye,
    },
    {
      label: 'Total page views',
      value: data.siteVisits.totalPageViews,
      hint: 'all time',
      icon: Eye,
    },
    {
      label: 'Unique visitors',
      value: data.siteVisits.totalUniqueVisitors,
      hint: 'all time',
      icon: Users,
    },
  ];

  return (
    <AdminLayout moduleName="Dashboard">
      <div className="min-h-full bg-muted/40 p-4 lg:p-6">
        {isSuperAdmin && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Site visits</h2>
              <p className="text-[11px] text-muted-foreground">
                Public pages only · set NEXT_PUBLIC_GA_MEASUREMENT_ID for Google Analytics
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {visitCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Card
                    key={card.label}
                    className="rounded-2xl border-border bg-card shadow-none gap-0 py-3 dark:border-sky-900/60"
                  >
                    <CardContent className="px-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                      </div>
                      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                        {loadingStats ? '…' : card.value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{card.hint}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
          {kpiCards.map((card) => (
            <Link key={card.label} href={card.href}>
              <Card className="rounded-2xl border-border shadow-none gap-0 py-3 hover:border-foreground/20 transition-colors">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                    {loadingStats ? '…' : card.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{card.hint}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="rounded-2xl border-border shadow-none gap-0 py-0 overflow-hidden xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border space-y-0 grid-rows-1">
              <CardTitle className="text-sm font-semibold text-foreground">Needs attention</CardTitle>
              <span className="text-xs text-muted-foreground">{attentionItems.length}</span>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loadingStats ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
              ) : attentionItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">All clear</p>
              ) : (
                <ul>
                  {attentionItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot(item.tone)}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {item.label}
                          </span>
                          <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                          {item.detail && (
                            <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                          )}
                        </span>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-none gap-0 py-0 overflow-hidden xl:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border space-y-0 grid-rows-1">
              <CardTitle className="text-sm font-semibold text-foreground">Active tournaments</CardTitle>
              <div className="flex items-center gap-3">
                <Link href="/admin/tournaments" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                  View all
                </Link>
                <Button
                  onClick={() => router.push('/admin/tournaments?create=1')}
                  className="h-8 rounded-lg bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loadingStats ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
              ) : activeTournaments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No upcoming or live tournaments</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="h-9 pl-4 text-xs font-medium text-muted-foreground">Tournament</TableHead>
                      <TableHead className="h-9 text-xs font-medium text-muted-foreground">Dates</TableHead>
                      <TableHead className="h-9 text-xs font-medium text-muted-foreground">Status</TableHead>
                      <TableHead className="h-9 pr-4 text-xs font-medium text-muted-foreground">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeTournaments.map((tournament) => (
                      <TableRow
                        key={tournament.id}
                        className="border-border/60 cursor-pointer hover:bg-muted/80"
                        onClick={() => router.push(`/admin/tournaments/${tournament.id}/overview`)}
                      >
                        <TableCell className="pl-4 py-2.5">
                          <p className="text-sm font-medium text-foreground truncate max-w-[220px]">{tournament.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {tournament.sport?.replace('-', ' ')}
                            {tournament.venue ? ` · ${tournament.venue}` : ''}
                          </p>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge className={`rounded-full border capitalize ${statusBadgeClass(tournament.status)}`}>
                            {tournament.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4 py-2.5 text-sm text-foreground/80">
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
          <Card className="rounded-2xl border-border shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border space-y-0 grid-rows-1">
              <CardTitle className="text-sm font-semibold text-foreground">Live now</CardTitle>
              {data.liveMatches.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                  <Play className="h-3 w-3" />
                  {data.liveMatches.length}
                </span>
              )}
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loadingStats ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
              ) : data.liveMatches.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No live matches</p>
              ) : (
                <ul>
                  {data.liveMatches.map((match) => (
                    <li key={match.id}>
                      <Link
                        href={match.href}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{match.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{match.tournamentName}</span>
                        </span>
                        <Badge className="rounded-full border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">Live</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="px-4 py-3 border-b border-border space-y-0 grid-rows-1">
              <CardTitle className="text-sm font-semibold text-foreground">Recent</CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loadingStats ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
              ) : data.recentItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No recent activity</p>
              ) : (
                <ul>
                  {data.recentItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot(item.tone)}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
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
