'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useTournament,
  useTournamentMatches,
  useTournamentRegistrations,
  useTournamentTeams,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { canAccessTournamentConsole, isFullTournamentAdmin } from '@/lib/permissions';
import { adminMatchScorePath, tournamentMatchRef } from '@/lib/firestore-paths';
import { scoreboardPath } from '@/lib/tournament-banner';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import TeamMatchLineupDialog from '@/components/TeamMatchLineupDialog';
import {
  OptionalSetScoreFields,
  emptySetScoreRows,
  matchSetsToScorePairs,
  scorePairsToMatchSets,
  type SetScorePair,
} from '@/components/scoring/OptionalSetScoreFields';
import { getFormatLabel, isBestOfThree } from '@/lib/match-scoring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Match, MatchSet } from '@/types';
import {
  isTeamTieMatch,
  isRubberMatch,
  countRubbersWon,
  rubberTypeLabel,
} from '@/lib/teamMatchRubbers';
import { formatMatchSideLabel } from '@/lib/utils';
import {
  getKnockoutPropagationUpdates,
  resolveKnockoutBracketSide,
} from '@/lib/knockoutBracket';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Swords,
  Monitor,
  Trophy,
  Clock,
  CheckCircle,
  Edit3,
  RotateCcw,
  ClipboardList,
  ChevronUp,
} from 'lucide-react';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const toISTLocal = (date: Date) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
const fromISTLocal = (value: string) => new Date(new Date(value + ':00Z').getTime() - IST_OFFSET_MS);

function statusColor(status: string) {
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

function statusLabel(status: string) {
  return status === 'not-scheduled' ? 'Not scheduled' : status;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString('en-IN', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

function rubberWinnerSide(rubber: Match): 1 | 2 | null {
  if (rubber.status !== 'completed') return null;
  if ((rubber.player1Score ?? 0) > (rubber.player2Score ?? 0)) return 1;
  if ((rubber.player2Score ?? 0) > (rubber.player1Score ?? 0)) return 2;
  return null;
}

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  const matchId = params.matchId as string;

  const { user } = useAuth();
  const { canWriteMatches } = usePermissions(tournamentId);
  const isFullAdmin = !!user && isFullTournamentAdmin(user, tournamentId);
  const canScore = canWriteMatches();
  const invalidate = useInvalidateTournament();
  const { alert, AlertDialogComponent } = useAlertDialog();

  const enabled = !!user && canAccessTournamentConsole(user, tournamentId) && !!tournamentId;
  const { data: tournament } = useTournament(tournamentId, { enabled });
  const { data: allMatches = [] } = useTournamentMatches(tournamentId, { enabled });
  const { data: registrations = [] } = useTournamentRegistrations(tournamentId, { enabled });
  const { data: teams = [] } = useTournamentTeams(tournamentId, { enabled });

  const regById = new Map(registrations.map(r => [r.id, r]));
  const teamIds = new Set(teams.map(t => t.id));

  const match = allMatches.find(m => m.id === matchId);
  const rubbers = allMatches
    .filter(m => isRubberMatch(m) && m.parentMatchId === matchId)
    .sort((a, b) => (a.rubberNumber ?? 0) - (b.rubberNumber ?? 0));

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [lineupOpen, setLineupOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  const [winnerPickOpen, setWinnerPickOpen] = useState(false);

  // Individual score form
  const [setsP1, setSetsP1] = useState('');
  const [setsP2, setSetsP2] = useState('');
  const [setScorePairs, setSetScorePairs] = useState<SetScorePair[]>(emptySetScoreRows());
  const [manualWinner, setManualWinner] = useState<string | null>(null);

  // Edit match details form
  const [editForm, setEditForm] = useState({
    scheduledTime: '', venue: '', court: '', referee: '', notes: '',
    matchFormat: 'best-of-3' as 'single-set-11' | 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30',
    status: 'scheduled' as Match['status'],
  });

  const backHref = `/admin/tournaments/${tournamentId}/matches`;

  if (!tournament || !match) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>;
  }

  const isTeamMatch = isTeamTieMatch(match, teamIds);
  const side1 = resolveKnockoutBracketSide(match.player1Id, match.player1Name, match, allMatches)
    ?? formatMatchSideLabel(match, 1, regById);
  const side2 = resolveKnockoutBracketSide(match.player2Id, match.player2Name, match, allMatches)
    ?? formatMatchSideLabel(match, 2, regById);
  const { team1: rubberWins1, team2: rubberWins2 } = countRubbersWon(rubbers);

  const team1Obj = teams.find(t => t.id === match.player1Id);
  const team2Obj = teams.find(t => t.id === match.player2Id);

  const isEditable = match.status !== 'cancelled';

  // Derive auto winner from individual sets input
  const p1Sets = parseInt(setsP1, 10);
  const p2Sets = parseInt(setsP2, 10);
  const autoWinner = !isNaN(p1Sets) && !isNaN(p2Sets)
    ? (p1Sets > p2Sets ? match.player1Name : p2Sets > p1Sets ? match.player2Name : null)
    : null;
  const effectiveWinner = manualWinner ?? autoWinner;

  const applyKnockoutPropagation = async (completedMatch: Match) => {
    const topLevel = allMatches.filter(m => !isRubberMatch(m));
    const updates = getKnockoutPropagationUpdates(completedMatch, topLevel);
    await Promise.all(
      updates.map(patch =>
        updateDoc(tournamentMatchRef(tournamentId, patch.matchId), {
          ...(patch.player1Id != null && { player1Id: patch.player1Id }),
          ...(patch.player1Name != null && { player1Name: patch.player1Name }),
          ...(patch.player2Id != null && { player2Id: patch.player2Id }),
          ...(patch.player2Name != null && { player2Name: patch.player2Name }),
          updatedAt: new Date(),
        }),
      ),
    );
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openScoreForm = () => {
    setSetsP1(String(match.player1Score ?? ''));
    setSetsP2(String(match.player2Score ?? ''));
    setSetScorePairs(matchSetsToScorePairs(match.sets ?? []));
    setManualWinner(match.winner ?? null);
    setScoreFormOpen(true);
    setWinnerPickOpen(false);
  };

  const saveIndividualResult = async () => {
    const p1 = parseInt(setsP1, 10);
    const p2 = parseInt(setsP2, 10);
    if (isNaN(p1) || isNaN(p2) || (p1 === 0 && p2 === 0)) {
      alert({ title: 'Invalid', description: 'At least one player must have sets won.', variant: 'error' });
      return;
    }
    if (!effectiveWinner) {
      alert({ title: 'Select winner', description: 'Please pick the winner before saving.', variant: 'error' });
      return;
    }
    const builtSets = scorePairsToMatchSets(setScorePairs);

    setSaving(true);
    try {
      const update: Record<string, unknown> = {
        status: 'completed', winner: effectiveWinner, player1Score: p1, player2Score: p2,
        actualEndTime: new Date(), updatedAt: new Date(),
      };
      if (builtSets.length > 0) update.sets = builtSets;
      if (!match.actualStartTime) update.actualStartTime = new Date();
      await updateDoc(tournamentMatchRef(tournamentId, matchId), update);
      await applyKnockoutPropagation({
        ...match,
        status: 'completed',
        winner: effectiveWinner,
        player1Score: p1,
        player2Score: p2,
      });
      invalidate(tournamentId);
      setScoreFormOpen(false);
      alert({ title: 'Saved', description: `Winner: ${effectiveWinner}`, variant: 'success' });
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to save result.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveWinner = async (winnerName: string) => {
    setSaving(true);
    try {
      const update: Record<string, unknown> = {
        winner: winnerName, status: 'completed', updatedAt: new Date(),
        actualEndTime: new Date(),
      };
      if (isTeamMatch) {
        update.player1Score = rubberWins1;
        update.player2Score = rubberWins2;
      }
      await updateDoc(tournamentMatchRef(tournamentId, matchId), update);
      await applyKnockoutPropagation({
        ...match,
        status: 'completed',
        winner: winnerName,
        ...(isTeamMatch && { player1Score: rubberWins1, player2Score: rubberWins2 }),
      });
      invalidate(tournamentId);
      setWinnerPickOpen(false);
      alert({ title: 'Winner set', description: winnerName, variant: 'success' });
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to set winner.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const completeTeamMatchByRubbers = async () => {
    if (rubberWins1 === rubberWins2) {
      alert({ title: 'Tied', description: 'Rubber scores are tied. Use "Set Winner" to pick the winner manually.', variant: 'error' });
      return;
    }
    const winnerName = rubberWins1 > rubberWins2 ? side1 : side2;
    await saveWinner(winnerName);
  };

  const reopenMatch = async () => {
    if (!confirm('Re-open this match? Status will be set back to live.')) return;
    setSaving(true);
    try {
      await updateDoc(tournamentMatchRef(tournamentId, matchId), {
        status: 'live', winner: null, updatedAt: new Date(),
      });
      invalidate(tournamentId);
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to re-open match.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openEditForm = () => {
    setEditForm({
      scheduledTime: toISTLocal(new Date(match.scheduledTime)),
      venue: match.venue ?? '',
      court: match.court ?? '',
      referee: match.referee ?? '',
      notes: match.notes ?? '',
      matchFormat: (match.matchFormat as 'single-set-11' | 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30') ?? 'best-of-3',
      status: match.status,
    });
    setEditOpen(true);
    setScoreFormOpen(false);
    setWinnerPickOpen(false);
  };

  const saveEditForm = async () => {
    setSaving(true);
    try {
      await updateDoc(tournamentMatchRef(tournamentId, matchId), {
        scheduledTime: fromISTLocal(editForm.scheduledTime),
        venue: editForm.venue,
        court: editForm.court || null,
        referee: editForm.referee || null,
        notes: editForm.notes || null,
        matchFormat: editForm.matchFormat,
        status: editForm.status,
        updatedAt: new Date(),
      });
      invalidate(tournamentId);
      setEditOpen(false);
      alert({ title: 'Saved', description: 'Match details updated.', variant: 'success' });
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to save.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteMatch = async () => {
    if (!confirm(`Delete this match?${rubbers.length > 0 ? ` This will also delete ${rubbers.length} rubber(s).` : ''}`)) return;
    setSaving(true);
    try {
      await Promise.all(rubbers.map(r => deleteDoc(tournamentMatchRef(tournamentId, r.id))));
      await deleteDoc(tournamentMatchRef(tournamentId, matchId));
      invalidate(tournamentId);
      router.push(backHref);
    } catch (e) {
      console.error(e);
      alert({ title: 'Error', description: 'Failed to delete match.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 w-full">
      {AlertDialogComponent}

      {/* Back */}
      <Link href={backHref}>
        <Button variant="ghost" size="sm" className="gap-1 -ml-2 text-gray-600">
          <ArrowLeft className="h-4 w-4" />
          Matches
        </Button>
      </Link>

      {/* Two-column layout on lg: left = header+forms, right = table */}
      <div className="space-y-4">

        {/* ── ROW 1: MATCH INFO ──────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* MATCH HEADER CARD */}
          <Card className="overflow-hidden">
            <div className={cn(
              'h-1',
              match.status === 'completed' && 'bg-green-500',
              match.status === 'live' && 'bg-red-500',
              match.status === 'scheduled' && 'bg-blue-500',
              match.status === 'cancelled' && 'bg-gray-400',
              match.status === 'postponed' && 'bg-yellow-400',
            )} />

            <CardContent className="pt-4 pb-4">
              {/* Chips row */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-xs text-gray-500 font-medium">
                  #{match.matchNumber} · {match.round}
                </span>
                {isTeamMatch && <Badge variant="outline" className="text-xs">Team Tie</Badge>}
                <Badge className={`text-xs ${statusColor(match.status)}`}>
                  {statusLabel(match.status)}
                </Badge>
                {match.matchFormat && (
                  <Badge variant="outline" className="text-xs text-gray-500">
                    {getFormatLabel(match.matchFormat)}
                  </Badge>
                )}
              </div>

              {/* Main content: score | meta + actions */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">

                {/* Score block */}
                <div className="shrink-0 w-full sm:min-w-[260px] sm:w-auto">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-base font-semibold leading-snug',
                        match.winner === match.player1Name ? 'text-gray-900' : 'text-gray-500',
                      )}>
                        {side1}
                      </p>
                    </div>
                    <div className="shrink-0 text-center">
                      {(isTeamMatch && rubbers.length > 0) || (!isTeamMatch && match.status === 'completed') ? (
                        <>
                          <div className="text-3xl font-bold tabular-nums tracking-tight">
                            {isTeamMatch
                              ? `${rubberWins1}–${rubberWins2}`
                              : `${match.player1Score ?? 0}–${match.player2Score ?? 0}`}
                          </div>
                          {isTeamMatch && rubbers.length > 0 && (
                            <div className="flex justify-center gap-1 mt-1.5">
                              {rubbers.map(r => {
                                const ws = rubberWinnerSide(r);
                                return (
                                  <span
                                    key={r.rubberNumber}
                                    title={`R${r.rubberNumber}: ${rubberTypeLabel(r.rubberType ?? 'single')}`}
                                    className={cn(
                                      'inline-block w-2.5 h-2.5 rounded-full border',
                                      ws === 1 && 'bg-indigo-500 border-indigo-500',
                                      ws === 2 && 'bg-amber-500 border-amber-500',
                                      !ws && 'bg-transparent border-gray-300',
                                    )}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-lg font-medium text-gray-400">vs</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className={cn(
                        'text-base font-semibold leading-snug',
                        match.winner === match.player2Name ? 'text-gray-900' : 'text-gray-500',
                      )}>
                        {side2}
                      </p>
                    </div>
                  </div>

                  {/* Rubber dot legend */}
                  {isTeamMatch && rubbers.length > 0 && (
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-2">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />{side1}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />{side2}
                      </span>
                    </div>
                  )}

                  {/* Winner banner */}
                  {match.winner && (
                    <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-green-50 text-green-800 text-sm font-medium mt-3">
                      <Trophy className="h-4 w-4 text-green-600 shrink-0" />
                      Winner: {match.winner}
                    </div>
                  )}
                </div>

                {/* Divider — vertical on desktop, horizontal on mobile */}
                <div className="hidden sm:block w-px self-stretch bg-gray-100 shrink-0" />
                <div className="block sm:hidden h-px w-full bg-gray-100" />

                {/* Meta */}
                <div className="flex-1 min-w-0 flex flex-wrap gap-x-6 gap-y-1.5 content-start">
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="text-xs">{formatDate(new Date(match.scheduledTime))}</span>
                  </div>
                  {match.venue && (
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs">{match.venue}{match.court ? ` · ${match.court}` : ''}</span>
                    </div>
                  )}
                  {match.actualStartTime && (
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs">Started: {formatDate(new Date(match.actualStartTime))}</span>
                    </div>
                  )}
                  {match.referee && (
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs">Referee: {match.referee}</span>
                    </div>
                  )}
                  {match.notes && (
                    <p className="text-xs text-gray-500 italic w-full">Note: {match.notes}</p>
                  )}
                </div>

              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 mt-4 pt-3">
                {/* Scoring page link */}
                {!isTeamMatch && canScore && (match.status === 'live' || match.status === 'scheduled') && (
                  <Link href={adminMatchScorePath(matchId, tournamentId)}>
                    <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                      <Swords className="h-3.5 w-3.5" />
                      {match.status === 'live' ? 'Update Score' : 'Start & Score'}
                    </Button>
                  </Link>
                )}
                {/* TV scoreboard */}
                {match.status === 'live' && (
                  <Link href={scoreboardPath(matchId, tournamentId)} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Monitor className="h-3.5 w-3.5" />
                      TV
                    </Button>
                  </Link>
                )}
                {/* Enter / Edit result for individual */}
                {!isTeamMatch && canScore && isEditable && (
                  <Button
                    size="sm"
                    variant={scoreFormOpen ? 'default' : match.status === 'completed' ? 'outline' : 'default'}
                    className="gap-1.5"
                    onClick={() => { setScoreFormOpen(v => !v); setEditOpen(false); setWinnerPickOpen(false); }}
                  >
                    {match.status === 'completed' ? <Edit3 className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    {match.status === 'completed' ? 'Edit Result' : 'Enter Result'}
                  </Button>
                )}
                {/* Complete team match */}
                {isTeamMatch && canScore && match.status !== 'completed' && match.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                    onClick={completeTeamMatchByRubbers}
                    disabled={saving}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Complete
                  </Button>
                )}
                {/* Set Winner — all editable matches */}
                {canScore && isEditable && (
                  <Button
                    size="sm"
                    variant={winnerPickOpen ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => { setWinnerPickOpen(v => !v); setScoreFormOpen(false); setEditOpen(false); }}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Set Winner
                  </Button>
                )}
                {/* Edit lineup */}
                {isTeamMatch && canScore && match.rubbersGenerated && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLineupOpen(true)}>
                    <ClipboardList className="h-3.5 w-3.5" />
                    Lineup
                  </Button>
                )}
                {/* Re-open */}
                {isFullAdmin && match.status === 'completed' && (
                  <Button
                    size="sm" variant="outline"
                    className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                    onClick={reopenMatch}
                    disabled={saving}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Re-open
                  </Button>
                )}
                {/* Edit details */}
                {isFullAdmin && (
                  <Button
                    size="sm" variant="outline" className="gap-1.5"
                    onClick={() => { openEditForm(); }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>

              {/* ── SET WINNER PANEL (inline in card) ── */}
              {winnerPickOpen && (
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Select the winner:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={match.winner === match.player1Name ? 'default' : 'outline'}
                      className={cn(
                        'gap-1.5 flex-1 justify-center',
                        match.winner === match.player1Name && 'bg-indigo-600 hover:bg-indigo-700',
                      )}
                      onClick={() => saveWinner(match.player1Name)}
                      disabled={saving}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      {side1}
                    </Button>
                    <Button
                      size="sm"
                      variant={match.winner === match.player2Name ? 'default' : 'outline'}
                      className={cn(
                        'gap-1.5 flex-1 justify-center',
                        match.winner === match.player2Name && 'bg-amber-600 hover:bg-amber-700',
                      )}
                      onClick={() => saveWinner(match.player2Name)}
                      disabled={saving}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      {side2}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── EDIT DETAILS FORM ──────────────────────────────────────────── */}
          {isFullAdmin && editOpen && (
            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Edit3 className="h-4 w-4" /> Edit Match Details
                  </CardTitle>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditOpen(false)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Scheduled Time (IST)</Label>
                    <Input type="datetime-local" step="60" value={editForm.scheduledTime}
                      onChange={e => setEditForm(f => ({ ...f, scheduledTime: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={editForm.status} onValueChange={(v: Match['status']) => setEditForm(f => ({ ...f, status: v }))}>
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
                  <div className="space-y-1">
                    <Label className="text-xs">Venue</Label>
                    <Input value={editForm.venue} onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Court</Label>
                    <Input placeholder="e.g. Court A" value={editForm.court} onChange={e => setEditForm(f => ({ ...f, court: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Referee</Label>
                    <Input value={editForm.referee} onChange={e => setEditForm(f => ({ ...f, referee: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Match Format</Label>
                    <Select value={editForm.matchFormat} onValueChange={(v: 'single-set-11' | 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30') => setEditForm(f => ({ ...f, matchFormat: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single-set-11">Single set (11pt)</SelectItem>
                        <SelectItem value="single-set">Single set (21pt)</SelectItem>
                        <SelectItem value="best-of-3">Best of 3 (21pt)</SelectItem>
                        <SelectItem value="best-of-3-15pt">Best of 3 (15pt)</SelectItem>
                        <SelectItem value="single-set-30">30pt Single set</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input placeholder="Optional notes" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={saveEditForm} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── ENTER / EDIT RESULT — individual match ─────────────────────── */}
          {!isTeamMatch && scoreFormOpen && (
            <Card className={match.status === 'completed' ? 'border-blue-200 bg-blue-50/30' : 'border-amber-200 bg-amber-50/30'}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {match.status === 'completed'
                      ? <><Edit3 className="h-4 w-4" /> Edit Result</>
                      : <><CheckCircle className="h-4 w-4" /> Enter Result</>}
                  </CardTitle>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setScoreFormOpen(false)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sets won */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs truncate block">{side1}</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Sets:</span>
                      <Input type="number" min={0} max={3} value={setsP1}
                        onChange={e => { setSetsP1(e.target.value); setManualWinner(null); }}
                        className="h-8 w-16 text-center" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs truncate block">{side2}</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Sets:</span>
                      <Input type="number" min={0} max={3} value={setsP2}
                        onChange={e => { setSetsP2(e.target.value); setManualWinner(null); }}
                        className="h-8 w-16 text-center" />
                    </div>
                  </div>
                </div>

                {/* Set scores (optional) */}
                <OptionalSetScoreFields
                  rows={setScorePairs}
                  setCount={isBestOfThree(match.matchFormat ?? 'best-of-3') ? 3 : 1}
                  player1Label={side1}
                  player2Label={side2}
                  onChange={(index, field, value) => {
                    setSetScorePairs((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
                    );
                  }}
                  labelClassName="text-xs text-gray-500"
                  inputClassName="h-8 text-xs"
                />

                {/* Winner selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Winner</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setManualWinner(match.player1Name)}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors text-left',
                        effectiveWinner === match.player1Name
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50',
                      )}
                    >
                      <Trophy className="inline h-3.5 w-3.5 mr-1.5" />
                      {side1}
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualWinner(match.player2Name)}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors text-left',
                        effectiveWinner === match.player2Name
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : 'border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50',
                      )}
                    >
                      <Trophy className="inline h-3.5 w-3.5 mr-1.5" />
                      {side2}
                    </button>
                  </div>
                  {effectiveWinner && (
                    <p className="text-xs text-gray-500">
                      Winner: <span className="font-medium text-gray-700">{effectiveWinner}</span>
                      {manualWinner && autoWinner && manualWinner !== autoWinner && (
                        <span className="ml-1 text-amber-600">(overridden)</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={saveIndividualResult} disabled={saving || !effectiveWinner}>
                    {saving ? 'Saving…' : match.status === 'completed' ? 'Update Result' : 'Save Result'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setScoreFormOpen(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>{/* end row 1 */}

        {/* ── ROW 2: TABLE ───────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* INDIVIDUAL SET SCORES */}
          {!isTeamMatch && match.sets && match.sets.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Set Scores</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="text-xs w-14 pl-4">Set</TableHead>
                      <TableHead className="text-xs">{side1}</TableHead>
                      <TableHead className="text-xs">{side2}</TableHead>
                      <TableHead className="text-xs">Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {match.sets.map(s => {
                      const s1Won = s.player1Score > s.player2Score;
                      const s2Won = s.player2Score > s.player1Score;
                      return (
                        <TableRow key={s.setNumber}>
                          <TableCell className="text-xs py-2.5 pl-4 font-medium text-gray-500">Set {s.setNumber}</TableCell>
                          <TableCell className={cn('text-sm py-2.5 font-bold tabular-nums', s1Won ? 'text-green-700' : 'text-gray-400')}>
                            {s.player1Score}
                          </TableCell>
                          <TableCell className={cn('text-sm py-2.5 font-bold tabular-nums', s2Won ? 'text-green-700' : 'text-gray-400')}>
                            {s.player2Score}
                          </TableCell>
                          <TableCell className="text-xs py-2.5 text-gray-600">
                            {s1Won ? side1 : s2Won ? side2 : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* RUBBERS TABLE */}
          {isTeamMatch && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm">Rubbers ({rubbers.length})</CardTitle>
                  {rubbers.length > 0 && (
                    <span className="text-xs font-medium">
                      <span className="text-indigo-600">{side1}</span>
                      <span className="mx-1.5 font-bold text-gray-700">{rubberWins1}–{rubberWins2}</span>
                      <span className="text-amber-600">{side2}</span>
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {rubbers.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-gray-500">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No rubbers yet — use &quot;Set Lineup&quot; from the matches list to generate rubbers.
                  </div>
                ) : (
                  <>
                    {/* Desktop */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/80">
                            <TableHead className="text-xs w-8 pl-4">#</TableHead>
                            <TableHead className="text-xs w-16">Type</TableHead>
                            <TableHead className="text-xs text-indigo-700 min-w-[130px]">{side1}</TableHead>
                            <TableHead className="text-xs text-amber-700 min-w-[130px]">{side2}</TableHead>
                            <TableHead className="text-xs w-32">Score</TableHead>
                            <TableHead className="text-xs min-w-[100px]">Winner</TableHead>
                            <TableHead className="text-right text-xs pr-4 w-28">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rubbers.map(rubber => {
                            const r1 = formatMatchSideLabel(rubber, 1, regById);
                            const r2 = formatMatchSideLabel(rubber, 2, regById);
                            const ws = rubberWinnerSide(rubber);
                            const canScoreRubber = canScore && (rubber.status === 'scheduled' || rubber.status === 'live');
                            const canEditRubber = canScore && rubber.status === 'completed';
                            return (
                              <TableRow
                                key={rubber.id}
                                className={cn(ws !== null && 'bg-green-50/50')}
                              >
                                <TableCell className="text-xs py-3 pl-4 font-semibold text-gray-500">
                                  {rubber.rubberNumber}
                                </TableCell>
                                <TableCell className="text-xs py-3 text-gray-500">
                                  {rubberTypeLabel(rubber.rubberType ?? 'single')}
                                </TableCell>
                                <TableCell className="text-xs py-3">
                                  <p className={cn('leading-snug', ws === 1 ? 'font-semibold text-green-700' : 'text-gray-600')}>{r1}</p>
                                  {rubber.sets?.map((s, i) => (
                                    <p key={i} className="text-xs text-gray-500 tabular-nums mt-0.5">{s.player1Score}</p>
                                  ))}
                                </TableCell>
                                <TableCell className="text-xs py-3">
                                  <p className={cn('leading-snug', ws === 2 ? 'font-semibold text-green-700' : 'text-gray-600')}>{r2}</p>
                                  {rubber.sets?.map((s, i) => (
                                    <p key={i} className="text-xs text-gray-500 tabular-nums mt-0.5">{s.player2Score}</p>
                                  ))}
                                </TableCell>
                                <TableCell className="text-xs py-3">
                                  {rubber.status === 'completed' ? (
                                    <span className="font-bold tabular-nums text-gray-700">
                                      {rubber.player1Score ?? 0}–{rubber.player2Score ?? 0}
                                    </span>
                                  ) : (
                                    <Badge className={`text-[10px] ${statusColor(rubber.status)}`}>
                                      {statusLabel(rubber.status)}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs py-3">
                                  {ws !== null ? (
                                    <span className="text-green-700 font-semibold flex items-center gap-0.5">
                                      <Trophy className="h-3 w-3" />
                                      {ws === 1 ? r1.split(' & ')[0] : r2.split(' & ')[0]}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right py-3 pr-4">
                                  <div className="flex items-center justify-end gap-1">
                                    {canScoreRubber && (
                                      <Link href={adminMatchScorePath(rubber.id, tournamentId)}>
                                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1">
                                          <Swords className="h-3 w-3" />
                                          Score
                                        </Button>
                                      </Link>
                                    )}
                                    {canEditRubber && (
                                      <Link href={adminMatchScorePath(rubber.id, tournamentId)}>
                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-gray-500">
                                          <Edit3 className="h-3 w-3" />
                                          Edit
                                        </Button>
                                      </Link>
                                    )}
                                    {rubber.status === 'live' && (
                                      <Link href={scoreboardPath(rubber.id, tournamentId)} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" title="TV scoreboard">
                                          <Monitor className="h-3 w-3" />
                                        </Button>
                                      </Link>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-gray-100">
                      {rubbers.map(rubber => {
                        const r1 = formatMatchSideLabel(rubber, 1, regById);
                        const r2 = formatMatchSideLabel(rubber, 2, regById);
                        const ws = rubberWinnerSide(rubber);
                        const canScoreRubber = canScore && (rubber.status === 'scheduled' || rubber.status === 'live');
                        return (
                          <div
                            key={rubber.id}
                            className={cn(
                              'px-4 py-3 space-y-2',
                              ws !== null && 'bg-green-50/40',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-gray-600">
                                R{rubber.rubberNumber} · {rubberTypeLabel(rubber.rubberType ?? 'single')}
                              </span>
                              {rubber.status !== 'completed'
                                ? <Badge className={`text-[10px] ${statusColor(rubber.status)}`}>{statusLabel(rubber.status)}</Badge>
                                : ws !== null
                                  ? <span className="text-[10px] font-semibold text-green-700 flex items-center gap-0.5">
                                      <Trophy className="h-3 w-3" />
                                      {ws === 1 ? r1.split(' & ')[0] : r2.split(' & ')[0]}
                                    </span>
                                  : null}
                            </div>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                              <div>
                                <p className={cn('text-sm font-medium', ws === 1 ? 'font-semibold text-green-700' : 'text-gray-600')}>{r1}</p>
                                {rubber.sets?.map((s, i) => (
                                  <p key={i} className="text-sm text-gray-500 tabular-nums mt-0.5">{s.player1Score}</p>
                                ))}
                              </div>
                              <div className="text-xs shrink-0 mt-0.5 text-center">
                                {rubber.status === 'completed'
                                  ? <span className="font-bold text-gray-700 tabular-nums">{rubber.player1Score ?? 0}–{rubber.player2Score ?? 0}</span>
                                  : <span className="text-gray-400">vs</span>}
                              </div>
                              <div className="text-right">
                                <p className={cn('text-sm font-medium', ws === 2 ? 'font-semibold text-green-700' : 'text-gray-600')}>{r2}</p>
                                {rubber.sets?.map((s, i) => (
                                  <p key={i} className="text-sm text-gray-500 tabular-nums mt-0.5 text-right">{s.player2Score}</p>
                                ))}
                              </div>
                            </div>
                            {(canScoreRubber || (canScore && rubber.status === 'completed')) && (
                              <div className="flex gap-1.5 pt-1">
                                <Link href={adminMatchScorePath(rubber.id, tournamentId)}>
                                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs touch-manipulation gap-1">
                                    {canScoreRubber ? <Swords className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                                    {canScoreRubber ? 'Score' : 'Edit Score'}
                                  </Button>
                                </Link>
                                {rubber.status === 'live' && (
                                  <Link href={scoreboardPath(rubber.id, tournamentId)} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="h-8 px-2 touch-manipulation">
                                      <Monitor className="h-3.5 w-3.5" />
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

        </div>{/* end row 2 */}
      </div>

      {/* ── LINEUP DIALOG ─────────────────────────────────────────────────── */}
      {isTeamMatch && canScore && lineupOpen && team1Obj && team2Obj && user && (
        <TeamMatchLineupDialog
          open={lineupOpen}
          onOpenChange={setLineupOpen}
          match={match}
          team1={team1Obj}
          team2={team2Obj}
          registrations={registrations}
          userId={user.id}
          existingRubbers={rubbers}
          onSaved={() => { invalidate(tournamentId); setLineupOpen(false); }}
        />
      )}
    </div>
  );
}
