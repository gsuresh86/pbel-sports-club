'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tournament } from '@/types';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { cloneTournament, deleteTournament } from '@/lib/tournament-api';
import { generateRegistrationLink } from '@/lib/utils';
import { canAccessTournamentConsole, isSystemAdmin } from '@/lib/permissions';
import { TournamentFormDrawer } from '@/components/admin/TournamentFormDrawer';
import {
  Plus,
  Edit,
  Eye,
  Copy,
  CopyPlus,
  Trash2,
  Loader2,
  Search,
  Filter,
  MapPin,
  ArrowRight,
  Trophy,
} from 'lucide-react';

type AlertPriority = 'high' | 'medium' | 'low';

interface PriorityAlert {
  id: string;
  tournamentId: string;
  priority: AlertPriority;
  title: string;
  description: string;
  timeLabel: string;
}

function daysUntil(date: Date): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function relativeFromNow(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const absHours = Math.abs(Math.round(diffMs / (1000 * 60 * 60)));
  if (absHours < 24) {
    return diffMs >= 0 ? `in ${absHours}h` : `${absHours}h ago`;
  }
  const days = Math.abs(Math.round(diffMs / (1000 * 60 * 60 * 24)));
  return diffMs >= 0 ? `in ${days}d` : `${days}d ago`;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateBlock(date: Date) {
  const d = new Date(date);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate().toString().padStart(2, '0'),
  };
}

function formatCurrency(amount?: number) {
  if (!amount) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function ManageTournamentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [operationTournamentId, setOperationTournamentId] = useState<string | null>(null);
  const [filteredTournaments, setFilteredTournaments] = useState<Tournament[]>([]);
  const [tournamentStats, setTournamentStats] = useState<{
    [key: string]: { registrations: number; players: number };
  }>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [tableScope, setTableScope] = useState<'all' | 'active'>('all');
  const openedEditFromUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !canAccessTournamentConsole(user)) {
      router.push('/login');
    } else if (user && canAccessTournamentConsole(user)) {
      loadTournaments();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    let filtered = tournaments;

    if (searchTerm) {
      filtered = filtered.filter(
        (tournament) =>
          tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tournament.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tournament.venue.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((tournament) => tournament.status === statusFilter);
    }

    if (sportFilter !== 'all') {
      filtered = filtered.filter((tournament) => tournament.sport === sportFilter);
    }

    if (tableScope === 'active') {
      filtered = filtered.filter(
        (tournament) => tournament.status === 'upcoming' || tournament.status === 'ongoing'
      );
    }

    setFilteredTournaments(filtered);
  }, [tournaments, searchTerm, statusFilter, sportFilter, tableScope]);

  const loadTournaments = async () => {
    try {
      const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      let tournamentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      if (user && !isSystemAdmin(user.role)) {
        const assignedIds = user.assignedTournaments ?? [];
        tournamentsData = tournamentsData.filter((tournament) =>
          assignedIds.includes(tournament.id)
        );
      }

      setTournaments(tournamentsData);
      await loadTournamentStats(tournamentsData);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTournamentStats = async (tournamentsData: Tournament[]) => {
    try {
      const stats: { [key: string]: { registrations: number; players: number } } = {};

      for (const tournament of tournamentsData) {
        const registrationsSnapshot = await getDocs(
          collection(db, 'tournaments', tournament.id, 'registrations')
        );
        const registrationsCount = registrationsSnapshot.docs.length;

        const seen = new Set<string>();
        for (const d of registrationsSnapshot.docs) {
          const data = d.data();
          const name = typeof data.name === 'string' ? data.name.trim().toLowerCase() : '';
          const partner =
            typeof data.partnerName === 'string' ? data.partnerName.trim().toLowerCase() : '';
          if (name) seen.add(name);
          if (partner) seen.add(partner);
        }

        stats[tournament.id] = {
          registrations: registrationsCount,
          players: seen.size,
        };
      }

      setTournamentStats(stats);
    } catch (error) {
      console.error('Error loading tournament stats:', error);
    }
  };

  const handleEdit = useCallback((tournament: Tournament) => {
    setEditingTournament(tournament);
    setDialogOpen(true);
  }, []);

  const handleCreate = () => {
    setEditingTournament(null);
    setDialogOpen(true);
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingTournament(null);
  };

  // The tournament console links here with ?edit=<id>. Reuse this drawer so
  // every edit entry point has the same fields and behavior.
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId || openedEditFromUrlRef.current === editId) return;

    const tournament = tournaments.find((item) => item.id === editId);
    if (!tournament) return;

    openedEditFromUrlRef.current = editId;
    handleEdit(tournament);
    window.history.replaceState(window.history.state, '', '/admin/tournaments');
  }, [handleEdit, tournaments]);

  const copyRegistrationLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert({
      title: 'Success',
      description: 'Registration link copied to clipboard!',
      variant: 'success',
    });
  };

  const isFullAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  const handleCloneTournament = (tournament: Tournament) => {
    confirm({
      title: 'Clone Tournament',
      description: `Create a full copy of "${tournament.name}" including registrations, teams, pools, matches, brackets, and winners? The copy will be set to upcoming with registration closed.`,
      confirmText: 'Clone',
      onConfirm: async () => {
        setOperationTournamentId(tournament.id);
        try {
          const newId = await cloneTournament(tournament.id, user!.id, {
            newName: `${tournament.name} (Copy)`,
          });
          await loadTournaments();
          alert({
            title: 'Tournament Cloned',
            description: `"${tournament.name} (Copy)" was created with all data.`,
            variant: 'success',
          });
          router.push(`/admin/tournaments/${newId}/overview`);
        } catch (error) {
          console.error('Error cloning tournament:', error);
          alert({
            title: 'Clone Failed',
            description: 'Failed to clone tournament. Please try again.',
            variant: 'error',
          });
        } finally {
          setOperationTournamentId(null);
        }
      },
    });
  };

  const handleDeleteTournament = (tournament: Tournament) => {
    confirm({
      title: 'Delete Tournament',
      description: `Permanently delete "${tournament.name}" and all related data (registrations, teams, pools, matches, brackets, winners)? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        setOperationTournamentId(tournament.id);
        try {
          await deleteTournament(tournament.id);
          await loadTournaments();
          alert({
            title: 'Tournament Deleted',
            description: `"${tournament.name}" and all related data have been removed.`,
            variant: 'success',
          });
        } catch (error) {
          console.error('Error deleting tournament:', error);
          alert({
            title: 'Delete Failed',
            description: 'Failed to delete tournament. Please try again.',
            variant: 'error',
          });
        } finally {
          setOperationTournamentId(null);
        }
      },
    });
  };

  const overviewStats = useMemo(() => {
    const totalTournaments = tournaments.length;
    const activeTournaments = tournaments.filter(
      (t) => t.status === 'upcoming' || t.status === 'ongoing'
    ).length;
    const registrationOpen = tournaments.filter((t) => t.registrationOpen).length;
    const totalPlayers = Object.values(tournamentStats).reduce((sum, s) => sum + s.players, 0);
    const totalRegistrations = Object.values(tournamentStats).reduce(
      (sum, s) => sum + s.registrations,
      0
    );
    const prizePool = tournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0);

    return {
      totalTournaments,
      activeTournaments,
      registrationOpen,
      totalPlayers,
      totalRegistrations,
      prizePool,
    };
  }, [tournaments, tournamentStats]);

  const priorityAlerts = useMemo((): PriorityAlert[] => {
    const alerts: PriorityAlert[] = [];

    for (const tournament of tournaments) {
      if (tournament.status === 'cancelled') continue;

      const deadline = tournament.registrationDeadline
        ? new Date(tournament.registrationDeadline)
        : null;
      const regs = tournamentStats[tournament.id]?.registrations ?? 0;
      const capacity = tournament.maxParticipants;
      const fillRate = capacity ? regs / capacity : 0;

      if (deadline && tournament.registrationOpen) {
        const days = daysUntil(deadline);
        if (days < 0) {
          alerts.push({
            id: `${tournament.id}-deadline-passed`,
            tournamentId: tournament.id,
            priority: 'high',
            title: 'Registration deadline passed',
            description: `${tournament.name} still has registration open after the deadline.`,
            timeLabel: relativeFromNow(deadline),
          });
        } else if (days <= 2) {
          alerts.push({
            id: `${tournament.id}-deadline-soon`,
            tournamentId: tournament.id,
            priority: 'high',
            title: 'Deadline closing soon',
            description: `Registration for ${tournament.name} closes ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}.`,
            timeLabel: relativeFromNow(deadline),
          });
        } else if (days <= 7) {
          alerts.push({
            id: `${tournament.id}-deadline-week`,
            tournamentId: tournament.id,
            priority: 'medium',
            title: 'Upcoming registration deadline',
            description: `${tournament.name} registration closes in ${days} days.`,
            timeLabel: relativeFromNow(deadline),
          });
        }
      }

      if (capacity && fillRate >= 0.85 && tournament.registrationOpen) {
        alerts.push({
          id: `${tournament.id}-near-full`,
          tournamentId: tournament.id,
          priority: fillRate >= 1 ? 'high' : 'medium',
          title: fillRate >= 1 ? 'Tournament at capacity' : 'Nearly full',
          description: `${tournament.name} has ${regs}/${capacity} registrations.`,
          timeLabel: 'now',
        });
      }

      if (
        tournament.status === 'upcoming' &&
        !tournament.registrationOpen &&
        deadline &&
        daysUntil(deadline) > 0
      ) {
        alerts.push({
          id: `${tournament.id}-reg-closed`,
          tournamentId: tournament.id,
          priority: 'low',
          title: 'Registration closed early',
          description: `${tournament.name} is upcoming but registration is closed.`,
          timeLabel: relativeFromNow(deadline),
        });
      }
    }

    const priorityOrder: Record<AlertPriority, number> = { high: 0, medium: 1, low: 2 };
    return alerts
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, 5);
  }, [tournaments, tournamentStats]);

  const upcomingSchedule = useMemo(() => {
    return [...tournaments]
      .filter((t) => t.status === 'upcoming' || t.status === 'ongoing')
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
  }, [tournaments]);

  const attentionTournaments = useMemo(() => {
    return tournaments
      .filter((t) => {
        const regs = tournamentStats[t.id]?.registrations ?? 0;
        const nearFull = t.maxParticipants ? regs / t.maxParticipants >= 0.8 : false;
        return (
          t.status === 'ongoing' ||
          nearFull ||
          (t.registrationOpen &&
            t.registrationDeadline &&
            daysUntil(new Date(t.registrationDeadline)) <= 7)
        );
      })
      .slice(0, 5);
  }, [tournaments, tournamentStats]);

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

  const getRegistrationBadgeClass = (open: boolean) =>
    open
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  const alertStyles: Record<
    AlertPriority,
    { wrap: string; label: string; labelColor: string }
  > = {
    high: {
      wrap: 'bg-rose-50 border-rose-100',
      label: 'High',
      labelColor: 'text-rose-700',
    },
    medium: {
      wrap: 'bg-amber-50 border-amber-100',
      label: 'Medium',
      labelColor: 'text-amber-700',
    },
    low: {
      wrap: 'bg-emerald-50 border-emerald-100',
      label: 'Low',
      labelColor: 'text-emerald-700',
    },
  };

  const dateBlockColors = [
    'bg-sky-50 text-sky-700',
    'bg-teal-50 text-teal-700',
    'bg-amber-50 text-amber-700',
    'bg-emerald-50 text-emerald-700',
    'bg-rose-50 text-rose-700',
  ];

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto" />
          <p className="mt-4 text-slate-500 text-sm">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout moduleName="Tournaments">
      <div className="min-h-full bg-[#f4f5f7] p-6 lg:p-8">
        {/* Page header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Tournaments Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track registrations, deadlines, and tournament status at a glance.
            </p>
          </div>
          {(user?.role === 'admin' || user?.role === 'super-admin') && (
            <Button
              onClick={handleCreate}
              className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Tournament
            </Button>
          )}
        </div>

        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-5">
            <CardContent className="px-5">
              <p className="text-sm text-slate-500">Total Tournaments</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {overviewStats.totalTournaments}
                </p>
                {overviewStats.activeTournaments > 0 && (
                  <span className="mb-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {overviewStats.activeTournaments} active
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-5">
            <CardContent className="px-5">
              <p className="text-sm text-slate-500">Active Players</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {overviewStats.totalPlayers}
                </p>
                <span className="mb-1 text-xs text-slate-400">
                  {overviewStats.totalRegistrations} regs
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-5">
            <CardContent className="px-5">
              <p className="text-sm text-slate-500">Registration Open</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {overviewStats.registrationOpen}
                </p>
                {overviewStats.registrationOpen > 0 && (
                  <span className="mb-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                    accepting entries
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-5">
            <CardContent className="px-5">
              <p className="text-sm text-slate-500">Prize Pool</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {overviewStats.prizePool > 0
                    ? formatCurrency(overviewStats.prizePool)
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mid widgets */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Priority alerts */}
          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="px-5 py-4 border-b border-slate-100">
              <CardTitle className="text-base font-semibold text-slate-900">
                Priority Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-3">
              {priorityAlerts.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  No urgent items right now
                </p>
              ) : (
                priorityAlerts.map((item) => {
                  const style = alertStyles[item.priority];
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border px-3.5 py-3 ${style.wrap}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${style.labelColor}`}>
                              {style.label}
                            </span>
                            <span className="text-xs text-slate-400">{item.timeLabel}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex gap-3">
                        <button
                          type="button"
                          className="text-xs font-medium text-slate-800 hover:underline"
                          onClick={() =>
                            router.push(`/admin/tournaments/${item.tournamentId}/overview`)
                          }
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-slate-500 hover:underline"
                          onClick={() => {
                            const t = tournaments.find((x) => x.id === item.tournamentId);
                            if (t) handleEdit(t);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Upcoming schedule */}
          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="px-5 py-4 border-b border-slate-100">
              <CardTitle className="text-base font-semibold text-slate-900">
                Upcoming Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-1">
              {upcomingSchedule.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  No upcoming tournaments
                </p>
              ) : (
                upcomingSchedule.map((tournament, index) => {
                  const block = formatDateBlock(tournament.startDate);
                  const days = daysUntil(new Date(tournament.startDate));
                  const caption =
                    tournament.status === 'ongoing'
                      ? 'In progress'
                      : days === 0
                        ? 'Starts today'
                        : days > 0
                          ? `Starts in ${days} day${days === 1 ? '' : 's'}`
                          : `Started ${Math.abs(days)}d ago`;

                  return (
                    <button
                      key={tournament.id}
                      type="button"
                      onClick={() =>
                        router.push(`/admin/tournaments/${tournament.id}/overview`)
                      }
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-center ${dateBlockColors[index % dateBlockColors.length]}`}
                      >
                        <span className="text-[10px] font-semibold leading-none tracking-wide">
                          {block.month}
                        </span>
                        <span className="mt-0.5 text-base font-bold leading-none">
                          {block.day}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {tournament.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">{caption}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Needs attention mini table */}
          <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
            <CardHeader className="px-5 py-4 border-b border-slate-100">
              <CardTitle className="text-base font-semibold text-slate-900">
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {attentionTournaments.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">All clear</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableHead className="h-10 pl-5 text-xs font-medium text-slate-400">
                        Tournament
                      </TableHead>
                      <TableHead className="h-10 text-xs font-medium text-slate-400">
                        Players
                      </TableHead>
                      <TableHead className="h-10 pr-5 text-xs font-medium text-slate-400">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attentionTournaments.map((tournament) => (
                      <TableRow
                        key={tournament.id}
                        className="border-slate-50 cursor-pointer hover:bg-slate-50/80"
                        onClick={() =>
                          router.push(`/admin/tournaments/${tournament.id}/overview`)
                        }
                      >
                        <TableCell className="pl-5 py-3">
                          <p className="text-sm font-medium text-slate-900 truncate max-w-[140px]">
                            {tournament.name}
                          </p>
                          <p className="text-xs text-slate-400 capitalize">
                            {tournament.sport.replace('-', ' ')}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-600">
                          {tournamentStats[tournament.id]?.players ?? 0}
                        </TableCell>
                        <TableCell className="pr-5 py-3">
                          <Badge
                            className={`rounded-full border capitalize ${getStatusBadgeClass(tournament.status)}`}
                          >
                            {tournament.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main tournaments table */}
        <Card className="rounded-2xl border-slate-200/80 shadow-none gap-0 py-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">All Tournaments</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Showing {filteredTournaments.length} of {tournaments.length}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by name, sport, or venue"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-full sm:w-64 rounded-xl border-slate-200 bg-white pl-9 text-sm focus-ring-thin"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-36 rounded-xl border-slate-200 focus-ring-thin">
                  <Filter className="h-3 w-3 mr-1 text-slate-400" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sportFilter} onValueChange={setSportFilter}>
                <SelectTrigger className="h-9 w-full sm:w-36 rounded-xl border-slate-200 focus-ring-thin">
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="badminton">Badminton</SelectItem>
                  <SelectItem value="table-tennis">Table Tennis</SelectItem>
                  <SelectItem value="volleyball">Volleyball</SelectItem>
                  <SelectItem value="throw-ball">Throw Ball</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setTableScope('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    tableScope === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTableScope('active')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    tableScope === 'active'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Active
                </button>
              </div>
            </div>
          </div>

          {filteredTournaments.length === 0 ? (
            <div className="py-16 text-center">
              {tournaments.length === 0 ? (
                <>
                  <Trophy className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <h3 className="text-base font-semibold text-slate-900">No tournaments yet</h3>
                  <p className="mt-1 text-sm text-slate-500 mb-4">
                    Create your first tournament to get started
                  </p>
                  {(user?.role === 'admin' || user?.role === 'super-admin') && (
                    <Button
                      onClick={handleCreate}
                      className="rounded-xl bg-slate-900 hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Create Tournament
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <h3 className="text-base font-semibold text-slate-900">No tournaments found</h3>
                  <p className="mt-1 text-sm text-slate-500 mb-4">
                    Try adjusting your search or filters
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setSportFilter('all');
                      setTableScope('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/60">
                    <TableHead className="h-11 pl-5 text-xs font-medium text-slate-400">
                      Tournament
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">Sport</TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Dates
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">Venue</TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Status
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Players
                    </TableHead>
                    <TableHead className="h-11 text-xs font-medium text-slate-400">
                      Registration
                    </TableHead>
                    <TableHead className="h-11 pr-5 text-right text-xs font-medium text-slate-400">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTournaments.map((tournament, index) => (
                    <TableRow
                      key={tournament.id}
                      className={`border-slate-50 ${
                        index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      } hover:bg-slate-50`}
                    >
                      <TableCell className="pl-5 py-3.5">
                        <div className="font-medium text-slate-900">{tournament.name}</div>
                        <div className="text-xs text-slate-400 capitalize">
                          {tournament.tournamentType?.replace('-', ' ')}
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="text-sm capitalize text-slate-700">
                          {tournament.sport.replace('-', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 text-sm text-slate-700 whitespace-nowrap">
                          <span>{formatDate(tournament.startDate)}</span>
                          <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                          <span>{formatDate(tournament.endDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 max-w-[160px]">
                          <MapPin className="h-3 w-3 text-slate-300 shrink-0" />
                          <span className="truncate">{tournament.venue}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge
                          className={`rounded-full border capitalize ${getStatusBadgeClass(tournament.status)}`}
                        >
                          {tournament.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="text-sm text-slate-700">
                          {tournamentStats[tournament.id]?.players ?? 0}
                          {tournament.maxParticipants ? (
                            <span className="text-slate-400">
                              {' '}
                              / {tournament.maxParticipants}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-400">
                          {tournamentStats[tournament.id]?.registrations ?? 0} regs
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge
                          className={`rounded-full border ${getRegistrationBadgeClass(tournament.registrationOpen)}`}
                        >
                          {tournament.registrationOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                            onClick={() =>
                              router.push(`/admin/tournaments/${tournament.id}/overview`)
                            }
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                            onClick={() => handleEdit(tournament)}
                            title="Edit Tournament"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                            onClick={() =>
                              copyRegistrationLink(generateRegistrationLink(tournament.id))
                            }
                            title="Copy Registration Link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {isFullAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                                disabled={operationTournamentId === tournament.id}
                                onClick={() => handleCloneTournament(tournament)}
                                title="Clone Tournament"
                              >
                                {operationTournamentId === tournament.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CopyPlus className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                disabled={operationTournamentId === tournament.id}
                                onClick={() => handleDeleteTournament(tournament)}
                                title="Delete Tournament"
                              >
                                {operationTournamentId === tournament.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <TournamentFormDrawer
        open={dialogOpen}
        onOpenChange={handleDrawerOpenChange}
        tournament={editingTournament}
        onSaved={() => loadTournaments()}
      />

      {AlertDialogComponent}
      {ConfirmDialogComponent}
    </AdminLayout>
  );
}
