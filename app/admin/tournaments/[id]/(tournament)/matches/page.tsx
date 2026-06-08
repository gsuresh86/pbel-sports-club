'use client';

import { useState } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Match } from '@/types';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { Activity, Edit, FilterX, Play, Search, Swords, Trash2 } from 'lucide-react';
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
    case 'cancelled': return 'bg-gray-100 text-gray-800';
    case 'postponed': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

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

  // pool name → category, for the category filter
  const poolNameToCategory = new Map(poolsData.map(p => [p.name, p.category]));

  const totalMatches = matches.length;

  const [search, setSearch] = useState('');
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD in IST

  const distinctRounds = Array.from(new Set(matches.map(m => m.round))).sort();
  const distinctCategories = Array.from(
    new Set(poolsData.map(p => p.category).filter(Boolean))
  ).sort() as string[];

  const q = search.toLowerCase();
  const filteredMatches = matches.filter(m => {
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
    matchFormat: 'best-of-3' as 'single-set' | 'best-of-3',
  });
  const [savingMatch, setSavingMatch] = useState(false);

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

  if (!tournament) return null;

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
        {totalMatches > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-shrink-0 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players, rounds…"
            className="h-8 pl-7 pr-3 w-48 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Round / Pool */}
        <Select value={roundFilter} onValueChange={setRoundFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Round / Pool" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rounds</SelectItem>
            {distinctRounds.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Category */}
        {distinctCategories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
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

        {/* Status */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="postponed">Postponed</SelectItem>
          </SelectContent>
        </Select>

        {/* Date (IST) */}
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          title="Filter by date (IST)"
          className="h-8 px-2 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring w-36"
        />

        {/* Clear filters icon button */}
        {anyFilterActive && (
          <button
            onClick={clearFilters}
            title="Clear all filters"
            className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
          >
            <FilterX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Match #</TableHead>
                  <TableHead className="text-xs sm:text-sm">Round</TableHead>
                  <TableHead className="text-xs sm:text-sm">Player 1</TableHead>
                  <TableHead className="text-xs sm:text-sm">Player 2</TableHead>
                  <TableHead className="text-xs sm:text-sm">Score</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm">Time</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...filteredMatches].sort((a, b) => a.matchNumber - b.matchNumber).map((match) => (
                  <TableRow key={match.id}>
                    <TableCell className="font-medium text-xs sm:text-sm py-2">#{match.matchNumber}</TableCell>
                    <TableCell className="text-xs sm:text-sm py-2">{match.round}</TableCell>
                    <TableCell className="text-xs sm:text-sm py-2 max-w-[80px] sm:max-w-none truncate">{match.player1Name}</TableCell>
                    <TableCell className="text-xs sm:text-sm py-2 max-w-[80px] sm:max-w-none truncate">{match.player2Name}</TableCell>
                    <TableCell className="text-xs sm:text-sm py-2">
                      {match.status === 'completed' ? (
                        <span className="font-semibold">{match.player1Score ?? '-'}-{match.player2Score ?? '-'}</span>
                      ) : match.status === 'live' && match.sets?.length ? (
                        <span className="text-green-600 text-xs sm:text-sm">
                          {match.sets.map((s) => `${s.player1Score}-${s.player2Score}`).join(', ')}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge className={`text-[10px] sm:text-xs ${getMatchStatusColor(match.status)}`}>{match.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm py-2 whitespace-nowrap">{formatDate(match.scheduledTime)}</TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:gap-2 sm:justify-end">
                        {match.status === 'scheduled' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-xs touch-manipulation"
                            onClick={async () => {
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
                            }}
                          >
                            <Play className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Start</span>
                          </Button>
                        )}
                        <Link href={`/admin/matches/${match.id}`} className="inline-block">
                          <Button size="sm" variant="outline" className="w-full sm:w-auto text-xs touch-manipulation">
                            <Swords className="h-4 w-4 sm:mr-1" />
                            {match.status === 'scheduled' ? 'Score' : match.status === 'live' ? 'Update' : 'View'}
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" className="text-xs touch-manipulation" onClick={() => openEditMatch(match)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="text-xs touch-manipulation text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteMatch(match.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredMatches.length === 0 && (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              {totalMatches === 0 ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No matches scheduled</h3>
                  <p className="text-gray-600">Generate matches from the Pools tab.</p>
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
                <Input type="datetime-local" value={editMatchForm.scheduledTime} onChange={(e) => setEditMatchForm((f) => ({ ...f, scheduledTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editMatchForm.status} onValueChange={(v: Match['status']) => setEditMatchForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
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
                <Select value={editMatchForm.matchFormat} onValueChange={(v: 'single-set' | 'best-of-3') => setEditMatchForm((f) => ({ ...f, matchFormat: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single-set">Single set</SelectItem>
                    <SelectItem value="best-of-3">Best of 3</SelectItem>
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
    </div>
  );
}
