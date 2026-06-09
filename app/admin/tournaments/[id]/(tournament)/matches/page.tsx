'use client';

import { Fragment, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  useTournament,
  useTournamentRegistrations,
  useTournamentMatches,
  useTournamentTeams,
  useTournamentPools,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Match } from '@/types';
import { scoreboardPath } from '@/lib/tournament-banner';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import GenerateMatchesPanel from '@/components/GenerateMatchesPanel';
import TeamMatchLineupDialog from '@/components/TeamMatchLineupDialog';
import {
  isTeamTieMatch,
  isRubberMatch,
  countRubbersWon,
} from '@/lib/teamMatchRubbers';
import { cn, getMatchSideDisplay } from '@/lib/utils';
import {
  Activity, ArrowDown, ArrowUp, ArrowUpDown,
  Edit, FilterX, Monitor, Play, Search, Square, Swords, Trash2, X,
} from 'lucide-react';
import Link from 'next/link';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const toISTLocal = (date: Date) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
const fromISTLocal = (value: string) => new Date(new Date(value + ':00Z').getTime() - IST_OFFSET_MS);

const isAdminRole = (role: string) =>
  role === 'admin' || role === 'tournament-admin' || role === 'super-admin';

function getMatchStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'live': return 'bg-red-100 text-red-800';
    case 'scheduled': return 'bg-blue-100 text-blue-800';
    case 'not-scheduled': return 'bg-gray-100 text-gray-600';
    case 'cancelled': return 'bg-gray-100 text-gray-800';
    case 'postponed': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getMatchStatusLabel(status: string) {
  return status === 'not-scheduled' ? 'Not scheduled' : status;
}

const MATCH_STATUSES: Match['status'][] = [
  'not-scheduled', 'scheduled', 'live', 'completed', 'cancelled', 'postponed',
];

function formatDate(date: Date) {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function formatDateShort(date: Date) {
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

type SortKey = 'matchNumber' | 'round' | 'status' | 'scheduledTime';

export default function MatchesPage() {
  const { user } = useAuth();
  const params = useParams();
  const tournamentId = params.id as string;
  const queriesEnabled = !!user && isAdminRole(user.role) && !!tournamentId;
  const { alert, AlertDialogComponent } = useAlertDialog();

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: registrationsData = [] } = useTournamentRegistrations(tournamentId, { enabled: queriesEnabled });
  const { data: matchesData = [] } = useTournamentMatches(tournamentId, { enabled: queriesEnabled });
  const { data: teamsData = [] } = useTournamentTeams(tournamentId, { enabled: queriesEnabled });
  const { data: poolsData = [] } = useTournamentPools(tournamentId, { enabled: queriesEnabled });
  const invalidateTournament = useInvalidateTournament();

  const tournament = tournamentData ?? null;
  const participants = registrationsData;
  const matches = matchesData;
  const teams = teamsData;

  const teamIds = new Set(teams.map(t => t.id));
  // Registration lookup so doubles matches can show both partners' first names
  const regById = new Map(participants.map(p => [p.id, p]));
  const poolNameToCategory = new Map(poolsData.map(p => [p.name, p.category]));
  const rubberMatches = matches.filter(isRubberMatch);
  const rubbersByParent = rubberMatches.reduce((map, rubber) => {
    const parentId = rubber.parentMatchId!;
    const list = map.get(parentId) ?? [];
    list.push(rubber);
    map.set(parentId, list);
    return map;
  }, new Map<string, Match[]>());
  for (const list of rubbersByParent.values()) {
    list.sort((a, b) => (a.rubberNumber ?? 0) - (b.rubberNumber ?? 0));
  }
  const topLevelMatches = matches.filter(m => !isRubberMatch(m));
  const totalMatches = topLevelMatches.length;

  const [search, setSearch] = useState('');
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  const distinctRounds = Array.from(new Set(topLevelMatches.map(m => m.round))).sort();
  const distinctCategories = Array.from(
    new Set(poolsData.map(p => p.category).filter(Boolean))
  ).sort() as string[];

  const q = search.toLowerCase();
  const filteredMatches = topLevelMatches.filter(m => {
    if (q && ![m.player1Name, m.player2Name, m.round].some(s => s.toLowerCase().includes(q))) return false;
    if (roundFilter !== 'all' && m.round !== roundFilter) return false;
    if (categoryFilter !== 'all' && poolNameToCategory.get(m.round) !== categoryFilter) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (dateFilter) {
      const matchDate = toISTLocal(new Date(m.scheduledTime)).slice(0, 10);
      if (matchDate !== dateFilter) return false;
    }
    return true;
  });

  const anyFilterActive = q || roundFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' || dateFilter;
  const clearFilters = () => { setSearch(''); setRoundFilter('all'); setCategoryFilter('all'); setStatusFilter('all'); setDateFilter(''); };

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('scheduledTime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="inline h-3 w-3 ml-1" />
      : <ArrowDown className="inline h-3 w-3 ml-1" />;
  };

  const sortedMatches = [...filteredMatches].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'matchNumber': cmp = a.matchNumber - b.matchNumber; break;
      case 'round': cmp = a.round.localeCompare(b.round); break;
      case 'status': cmp = a.status.localeCompare(b.status); break;
      case 'scheduledTime': {
        const tA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
        const tB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
        cmp = tA - tB;
        break;
      }
    }
    if (cmp === 0) cmp = a.matchNumber - b.matchNumber;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<Match['status'] | ''>('');
  const [bulkWorking, setBulkWorking] = useState(false);

  const visibleIds = sortedMatches.map(m => m.id);
  const selectedVisible = visibleIds.filter(id => selectedIds.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const applyBulkStatus = async (status: Match['status']) => {
    if (selectedVisible.length === 0) return;
    setBulkWorking(true);
    try {
      await Promise.all(selectedVisible.map(id =>
        updateDoc(doc(db, 'matches', id), { status, updatedAt: new Date() })
      ));
      invalidateTournament(tournamentId);
      setBulkStatus('');
      clearSelection();
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to update matches', variant: 'error' });
    } finally {
      setBulkWorking(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedVisible.length === 0) return;
    if (!confirm(`Delete ${selectedVisible.length} selected match${selectedVisible.length === 1 ? '' : 'es'}? This cannot be undone.`)) return;
    setBulkWorking(true);
    try {
      await Promise.all(selectedVisible.map(id => deleteDoc(doc(db, 'matches', id))));
      invalidateTournament(tournamentId);
      clearSelection();
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to delete matches', variant: 'error' });
    } finally {
      setBulkWorking(false);
    }
  };

  const [lineupMatch, setLineupMatch] = useState<Match | null>(null);

  // Match action handlers
  const handleStartMatch = async (match: Match) => {
    if (isTeamTieMatch(match, teamIds) && !match.rubbersGenerated) {
      setLineupMatch(match);
      return;
    }
    try {
      await updateDoc(doc(db, 'matches', match.id), { status: 'live', actualStartTime: new Date(), updatedAt: new Date() });
      await setDoc(doc(db, 'liveScores', match.id), {
        matchId: match.id,
        tournamentId: match.tournamentId,
        player1Name: match.player1Name,
        player2Name: match.player2Name,
        currentSet: 1,
        player1Sets: 0,
        player2Sets: 0,
        player1CurrentScore: 0,
        player2CurrentScore: 0,
        isLive: true,
        lastUpdated: new Date(),
      });
      invalidateTournament(tournamentId);
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to start match', variant: 'error' });
    }
  };

  const handleStopMatch = async (match: Match) => {
    if (!confirm('Stop this match and return it to scheduled? Live scores will be cleared.')) return;
    try {
      await updateDoc(doc(db, 'matches', match.id), { status: 'scheduled', actualStartTime: null, updatedAt: new Date() });
      await deleteDoc(doc(db, 'liveScores', match.id));
      invalidateTournament(tournamentId);
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to stop match', variant: 'error' });
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm('Delete this match? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'matches', matchId));
      invalidateTournament(tournamentId);
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to delete match', variant: 'error' });
    }
  };

  const [editMatchOpen, setEditMatchOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editMatchForm, setEditMatchForm] = useState({
    round: '',
    matchNumber: '',
    player1Id: '',
    player2Id: '',
    scheduledTime: '',
    venue: '',
    court: '',
    referee: '',
    status: 'scheduled' as Match['status'],
    notes: '',
    matchFormat: 'best-of-3' as 'single-set' | 'best-of-3' | 'single-set-30',
  });
  const [savingMatch, setSavingMatch] = useState(false);
  const [genDrawerOpen, setGenDrawerOpen] = useState(false);

  const openEditMatch = (match: Match) => {
    setEditingMatch(match);
    setEditMatchForm({
      round: match.round,
      matchNumber: String(match.matchNumber),
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      scheduledTime: toISTLocal(new Date(match.scheduledTime)),
      venue: match.venue,
      court: match.court ?? '',
      referee: match.referee ?? '',
      status: match.status,
      notes: match.notes ?? '',
      matchFormat: (match as any).matchFormat ?? 'best-of-3',
    });
    setEditMatchOpen(true);
  };

  const saveEditMatch = async () => {
    if (!editingMatch) return;
    const isTeamMatch = teamIds.has(editingMatch.player1Id) || teamIds.has(editingMatch.player2Id);
    const lookup1 = isTeamMatch
      ? teams.find((t) => t.id === editMatchForm.player1Id)
      : participants.find((p) => p.id === editMatchForm.player1Id);
    const lookup2 = isTeamMatch
      ? teams.find((t) => t.id === editMatchForm.player2Id)
      : participants.find((p) => p.id === editMatchForm.player2Id);
    if (!lookup1 || !lookup2) {
      alert({ title: 'Error', description: `Select valid ${isTeamMatch ? 'teams' : 'players'}`, variant: 'error' });
      return;
    }
    setSavingMatch(true);
    try {
      await updateDoc(doc(db, 'matches', editingMatch.id), {
        round: editMatchForm.round,
        matchNumber: parseInt(editMatchForm.matchNumber),
        player1Id: lookup1.id,
        player1Name: lookup1.name,
        player2Id: lookup2.id,
        player2Name: lookup2.name,
        scheduledTime: fromISTLocal(editMatchForm.scheduledTime),
        venue: editMatchForm.venue,
        court: editMatchForm.court || null,
        referee: editMatchForm.referee || null,
        status: editMatchForm.status,
        notes: editMatchForm.notes || null,
        matchFormat: editMatchForm.matchFormat,
        updatedAt: new Date(),
      });
      invalidateTournament(tournamentId);
      setEditMatchOpen(false);
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to save match', variant: 'error' });
    } finally {
      setSavingMatch(false);
    }
  };

  if (!tournament) return null;

  const renderTeamTieScore = (match: Match) => {
    const rubbers = rubbersByParent.get(match.id) ?? [];
    if (rubbers.length === 0) return <span className="text-gray-400">—</span>;
    const { team1, team2 } = countRubbersWon(rubbers);
    return <span className="font-semibold">{team1}-{team2}</span>;
  };

  const renderRubberLabel = (rubber: Match) => {
    const p1 = rubber.rubberType === 'doubles' && rubber.player1PartnerName
      ? `${rubber.player1Name} & ${rubber.player1PartnerName}`
      : rubber.player1Name;
    const p2 = rubber.rubberType === 'doubles' && rubber.player2PartnerName
      ? `${rubber.player2Name} & ${rubber.player2PartnerName}`
      : rubber.player2Name;
    return `${p1} vs ${p2}`;
  };

  // Reusable score display
  const renderScore = (match: Match) => {
    if (isTeamTieMatch(match, teamIds)) return renderTeamTieScore(match);
    if (match.status === 'completed')
      return <span className="font-semibold">{match.player1Score ?? '-'}-{match.player2Score ?? '-'}</span>;
    if (match.status === 'live' && match.sets?.length)
      return <span className="text-green-600 text-xs">{match.sets.map(s => `${s.player1Score}-${s.player2Score}`).join(', ')}</span>;
    return <span className="text-gray-400">-</span>;
  };

  const renderRubbers = (match: Match) => {
    const rubbers = rubbersByParent.get(match.id);
    if (!rubbers?.length) return null;
    return (
      <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Rubbers</p>
        {rubbers.map(rubber => (
          <div key={rubber.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-600 shrink-0">#{rubber.rubberNumber} {rubber.rubberType}</span>
            <span className="truncate text-gray-800">{renderRubberLabel(rubber)}</span>
            <div className="flex items-center gap-1 shrink-0">
              <Badge className={`text-[10px] px-1 ${getMatchStatusColor(rubber.status)}`}>
                {getMatchStatusLabel(rubber.status)}
              </Badge>
              {(rubber.status === 'scheduled' || rubber.status === 'live') && (
                <Link href={`/admin/matches/${rubber.id}`}>
                  <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px]">
                    Score
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {AlertDialogComponent}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold sm:text-lg">
            Matches ({filteredMatches.length}{filteredMatches.length !== totalMatches ? ` of ${totalMatches}` : ''})
          </h3>
          <p className="text-xs text-gray-600 sm:text-sm">Start matches and enter scores below.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" className="h-8 text-xs" onClick={() => setGenDrawerOpen(true)}>
            <Swords className="h-3.5 w-3.5 mr-1" />
            Generate
          </Button>
          {totalMatches > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
              onClick={async () => {
                if (!confirm(`Delete all ${totalMatches} match${totalMatches === 1 ? '' : 'es'} for this tournament? This cannot be undone.`)) return;
                try {
                  await Promise.all(matches.map((m) => deleteDoc(doc(db, 'matches', m.id))));
                  invalidateTournament(tournamentId);
                } catch (e) {
                  console.error(e);
                  alert({ title: 'Error', description: 'Failed to clear matches', variant: 'error' });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        {/* Search + clear — full width on mobile */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players, rounds…"
              className="h-8 pl-7 pr-3 w-full md:w-48 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {anyFilterActive && (
            <button
              onClick={clearFilters}
              title="Clear all filters"
              className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            >
              <FilterX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Filter selects — 2-col grid on mobile, row on larger */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={roundFilter} onValueChange={setRoundFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Round / Pool" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rounds</SelectItem>
              {distinctRounds.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          {distinctCategories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {distinctCategories.map(c => (
                  <SelectItem key={c} value={c}>
                    {c.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not-scheduled">Not scheduled</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="postponed">Postponed</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            title="Filter by date (IST)"
            className="h-8 px-2 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedVisible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-xs font-medium text-blue-900">{selectedVisible.length} selected</span>
          <Select
            value={bulkStatus}
            onValueChange={(v: Match['status']) => { setBulkStatus(v); applyBulkStatus(v); }}
            disabled={bulkWorking}
          >
            <SelectTrigger className="h-8 w-40 text-xs bg-white">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {MATCH_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{getMatchStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
            onClick={bulkDelete}
            disabled={bulkWorking}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
          <button
            onClick={clearSelection}
            disabled={bulkWorking}
            className="text-xs text-gray-500 hover:text-gray-800 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      <Card className="rounded-none">
        <CardContent className="p-0">

          {/* ── Mobile card list (hidden md+) ── */}
          <div className="md:hidden divide-y divide-gray-100">
            {sortedMatches.map((match) => (
              <div
                key={match.id}
                className={cn(
                  'px-3 py-3 space-y-2',
                  selectedIds.has(match.id) && 'bg-blue-50',
                )}
              >
                {/* Top row */}
                <div className="flex items-start gap-2">
                  <Checkbox
                    className="mt-0.5 flex-shrink-0"
                    checked={selectedIds.has(match.id)}
                    onCheckedChange={() => toggleSelect(match.id)}
                    aria-label={`Select match ${match.matchNumber}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 font-medium">
                        #{match.matchNumber} · {match.round}
                      </span>
                      <Badge className={`text-[10px] px-1.5 ${getMatchStatusColor(match.status)}`}>
                        {getMatchStatusLabel(match.status)}
                      </Badge>
                    </div>
                    {/* Players */}
                    <div className="mt-1 text-sm font-medium leading-snug">
                      <span>{getMatchSideDisplay(match.player1Id, match.player1Name, regById).label}</span>
                      <span className="text-gray-400 font-normal mx-1.5">vs</span>
                      <span>{getMatchSideDisplay(match.player2Id, match.player2Name, regById).label}</span>
                    </div>
                    {/* Score + time */}
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">{formatDateShort(new Date(match.scheduledTime))}</span>
                      <span className="text-xs">{renderScore(match)}</span>
                    </div>
                    {isTeamTieMatch(match, teamIds) && renderRubbers(match)}
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                  {match.status === 'scheduled' && (
                    <Button
                      size="sm"
                      className="h-9 text-xs bg-green-600 hover:bg-green-700 touch-manipulation"
                      onClick={() => handleStartMatch(match)}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      {isTeamTieMatch(match, teamIds) && !match.rubbersGenerated ? 'Set Lineup' : 'Start'}
                    </Button>
                  )}
                  {match.status === 'live' && (
                    <Button
                      size="sm"
                      className="h-9 text-xs bg-orange-500 hover:bg-orange-600 touch-manipulation"
                      onClick={() => handleStopMatch(match)}
                    >
                      <Square className="h-3.5 w-3.5 mr-1" />
                      Stop
                    </Button>
                  )}
                  {(match.status === 'scheduled' || match.status === 'live') && !isTeamTieMatch(match, teamIds) && (
                    <Link href={`/admin/matches/${match.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full h-9 text-xs touch-manipulation">
                        <Swords className="h-3.5 w-3.5 mr-1" />
                        {match.status === 'scheduled' ? 'Score' : 'Update'}
                      </Button>
                    </Link>
                  )}
                  {match.status === 'live' && !isTeamTieMatch(match, teamIds) && (
                    <Link href={scoreboardPath(match.id, tournamentId)} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-9 w-9 p-0 flex-shrink-0 touch-manipulation" title="Open TV scoreboard">
                        <Monitor className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    className="h-9 w-9 p-0 flex-shrink-0 touch-manipulation"
                    onClick={() => openEditMatch(match)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="h-9 w-9 p-0 flex-shrink-0 touch-manipulation text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteMatch(match.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop table (hidden below md) ── */}
          <div className="hidden md:block overflow-auto max-h-[calc(100vh-16rem)]">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all matches"
                    />
                  </TableHead>
                  <TableHead
                    className="text-xs cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('matchNumber')}
                  >
                    Match # <SortIcon col="matchNumber" />
                  </TableHead>
                  <TableHead
                    className="text-xs cursor-pointer select-none"
                    onClick={() => toggleSort('round')}
                  >
                    Round <SortIcon col="round" />
                  </TableHead>
                  <TableHead className="text-xs">Player 1</TableHead>
                  <TableHead className="text-xs">Player 2</TableHead>
                  <TableHead className="text-xs">Score</TableHead>
                  <TableHead
                    className="text-xs cursor-pointer select-none"
                    onClick={() => toggleSort('status')}
                  >
                    Status <SortIcon col="status" />
                  </TableHead>
                  <TableHead
                    className="text-xs cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('scheduledTime')}
                  >
                    Time <SortIcon col="scheduledTime" />
                  </TableHead>
                  <TableHead className="text-right text-xs w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMatches.map((match) => (
                  <Fragment key={match.id}>
                  <TableRow data-state={selectedIds.has(match.id) ? 'selected' : undefined}>
                    <TableCell className="py-2">
                      <Checkbox
                        checked={selectedIds.has(match.id)}
                        onCheckedChange={() => toggleSelect(match.id)}
                        aria-label={`Select match ${match.matchNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-xs py-2">
                      #{match.matchNumber}
                      {isTeamTieMatch(match, teamIds) && (
                        <Badge variant="outline" className="ml-1 text-[10px]">Team</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs py-2">{match.round}</TableCell>
                    <TableCell className="text-xs py-2 max-w-[120px] truncate">{getMatchSideDisplay(match.player1Id, match.player1Name, regById).label}</TableCell>
                    <TableCell className="text-xs py-2 max-w-[120px] truncate">{getMatchSideDisplay(match.player2Id, match.player2Name, regById).label}</TableCell>
                    <TableCell className="text-xs py-2">{renderScore(match)}</TableCell>
                    <TableCell className="py-2">
                      <Badge className={`text-[10px] ${getMatchStatusColor(match.status)}`}>
                        {getMatchStatusLabel(match.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs py-2 whitespace-nowrap">{formatDate(new Date(match.scheduledTime))}</TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-1">
                        {match.status === 'scheduled' && (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 touch-manipulation"
                            onClick={() => handleStartMatch(match)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {isTeamTieMatch(match, teamIds) && !match.rubbersGenerated ? 'Lineup' : 'Start'}
                          </Button>
                        )}
                        {match.status === 'live' && (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs bg-orange-500 hover:bg-orange-600 touch-manipulation"
                            onClick={() => handleStopMatch(match)}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Stop
                          </Button>
                        )}
                        {(match.status === 'scheduled' || match.status === 'live') && !isTeamTieMatch(match, teamIds) && (
                          <Link href={`/admin/matches/${match.id}`} className="inline-block">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs touch-manipulation">
                              <Swords className="h-3 w-3 mr-1" />
                              {match.status === 'scheduled' ? 'Score' : 'Update'}
                            </Button>
                          </Link>
                        )}
                        {match.status === 'live' && !isTeamTieMatch(match, teamIds) && (
                          <Link href={scoreboardPath(match.id, tournamentId)} target="_blank" rel="noopener noreferrer" className="inline-block">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs touch-manipulation" title="Open TV scoreboard">
                              <Monitor className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-xs touch-manipulation"
                          onClick={() => openEditMatch(match)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-xs touch-manipulation text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteMatch(match.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isTeamTieMatch(match, teamIds) && rubbersByParent.get(match.id)?.length ? (
                    <TableRow key={`${match.id}-rubbers`} className="bg-gray-50/80 hover:bg-gray-50/80">
                      <TableCell colSpan={9} className="py-2 px-4">
                        {renderRubbers(match)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Empty state */}
          {filteredMatches.length === 0 && (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              {totalMatches === 0 ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No matches scheduled</h3>
                  <p className="text-gray-600">Click <strong>Generate</strong> to create matches from pools.</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No matches match your filters</h3>
                  <button className="text-sm text-blue-600 hover:underline" onClick={clearFilters}>Clear filters</button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Matches Panel */}
      {genDrawerOpen && (
        <>
          {/* Backdrop — z-[51]: covers left-nav sidebar (z-50) so only the panel is lit */}
          <div
            className="fixed inset-0 z-[51] bg-black/40"
            onClick={() => setGenDrawerOpen(false)}
          />
          {/* Panel — z-[52]: above backdrop; Radix portals forced to z-[60] via globals.css */}
          <div className="fixed inset-y-0 right-0 z-[52] flex w-full max-w-4xl flex-col bg-white shadow-2xl">
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold">Generate Matches</h2>
              <button
                onClick={() => setGenDrawerOpen(false)}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {tournament && user && (
                <GenerateMatchesPanel
                  tournament={tournament}
                  user={user}
                  onNotify={alert}
                  onGenerated={(totalCreated) => {
                    setGenDrawerOpen(false);
                    alert({
                      title: 'Done!',
                      description: `Created ${totalCreated} match${totalCreated === 1 ? '' : 'es'} successfully.`,
                      variant: 'success',
                    });
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Match Dialog */}
      <Dialog open={editMatchOpen} onOpenChange={setEditMatchOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Match</DialogTitle>
            <DialogDescription>Update match details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Round</Label>
                <Input value={editMatchForm.round} onChange={(e) => setEditMatchForm((f) => ({ ...f, round: e.target.value }))} placeholder="e.g. Quarter Final" />
              </div>
              <div className="space-y-1">
                <Label>Match #</Label>
                <Input type="number" value={editMatchForm.matchNumber} onChange={(e) => setEditMatchForm((f) => ({ ...f, matchNumber: e.target.value }))} />
              </div>
            </div>
            {(() => {
              const isTeamMatch = editingMatch
                ? teamIds.has(editingMatch.player1Id) || teamIds.has(editingMatch.player2Id)
                : false;
              const label1 = isTeamMatch ? 'Team 1' : 'Player 1';
              const label2 = isTeamMatch ? 'Team 2' : 'Player 2';
              const placeholder = isTeamMatch ? 'Select team' : 'Select player';
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{label1}</Label>
                    <Select value={editMatchForm.player1Id} onValueChange={(v) => setEditMatchForm((f) => ({ ...f, player1Id: v }))}>
                      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
                      <SelectContent>
                        {isTeamMatch
                          ? teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                          : participants.filter((p) => p.registrationStatus === 'approved').map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{label2}</Label>
                    <Select value={editMatchForm.player2Id} onValueChange={(v) => setEditMatchForm((f) => ({ ...f, player2Id: v }))}>
                      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
                      <SelectContent>
                        {isTeamMatch
                          ? teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                          : participants.filter((p) => p.registrationStatus === 'approved').map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Scheduled Time (IST)</Label>
                <Input type="datetime-local" step="60" value={editMatchForm.scheduledTime} onChange={(e) => setEditMatchForm((f) => ({ ...f, scheduledTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editMatchForm.status} onValueChange={(v: Match['status']) => setEditMatchForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-scheduled">Not scheduled</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="postponed">Postponed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Venue</Label>
                <Input value={editMatchForm.venue} onChange={(e) => setEditMatchForm((f) => ({ ...f, venue: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Court</Label>
                <Input value={editMatchForm.court} onChange={(e) => setEditMatchForm((f) => ({ ...f, court: e.target.value }))} placeholder="e.g. Court 1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Referee</Label>
                <Input value={editMatchForm.referee} onChange={(e) => setEditMatchForm((f) => ({ ...f, referee: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Match Format</Label>
                <Select value={editMatchForm.matchFormat} onValueChange={(v: 'single-set' | 'best-of-3' | 'single-set-30') => setEditMatchForm((f) => ({ ...f, matchFormat: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single-set">Single set (21pt)</SelectItem>
                    <SelectItem value="best-of-3">Best of 3</SelectItem>
                    <SelectItem value="single-set-30">30pt Single set</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={editMatchForm.notes} onChange={(e) => setEditMatchForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditMatchOpen(false)}>Cancel</Button>
              <Button onClick={saveEditMatch} disabled={savingMatch}>{savingMatch ? 'Saving…' : 'Save Changes'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {lineupMatch && user && (() => {
        const team1 = teams.find(t => t.id === lineupMatch.player1Id);
        const team2 = teams.find(t => t.id === lineupMatch.player2Id);
        if (!team1 || !team2) return null;
        return (
          <TeamMatchLineupDialog
            open={!!lineupMatch}
            onOpenChange={(open) => { if (!open) setLineupMatch(null); }}
            match={lineupMatch}
            team1={team1}
            team2={team2}
            registrations={participants}
            userId={user.id}
            onSaved={() => invalidateTournament(tournamentId)}
          />
        );
      })()}
    </div>
  );
}
