'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Match, LiveScore, MatchSet } from '@/types';
import { Play, Pause, Trophy, Clock, Target, RefreshCw, Edit3 } from 'lucide-react';

export default function LiveScoringPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const matchId = params.id as string;
  const [match, setMatch] = useState<Match | null>(null);
  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [player1Sets, setPlayer1Sets] = useState(0);
  const [player2Sets, setPlayer2Sets] = useState(0);
  const [winner, setWinner] = useState<string>('');
  // Direct score entry
  const [directSetsP1, setDirectSetsP1] = useState<string>('0');
  const [directSetsP2, setDirectSetsP2] = useState<string>('0');
  const [directSet1, setDirectSet1] = useState<string>(''); // e.g. "21-19"
  const [directSet2, setDirectSet2] = useState<string>('');
  const [directSet3, setDirectSet3] = useState<string>('');
  const [tournamentMatchFormat, setTournamentMatchFormat] = useState<'single-set' | 'best-of-3'>('best-of-3');

  const canAccessAdmin = user?.role === 'admin' || user?.role === 'super-admin' || user?.role === 'tournament-admin';

  useEffect(() => {
    if (!authLoading && (!user || !canAccessAdmin)) {
      router.push('/login');
    } else if (user && canAccessAdmin && matchId) {
      loadMatch();
      setupLiveScoreListener();
    }
  }, [user, authLoading, router, matchId, canAccessAdmin]);

  const loadMatch = async () => {
    try {
      const docRef = doc(db, 'matches', matchId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const matchData = {
          id: docSnap.id,
          ...data,
          scheduledTime: data.scheduledTime?.toDate(),
          actualStartTime: data.actualStartTime?.toDate(),
          actualEndTime: data.actualEndTime?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Match;
        // Tournament-admin may only access matches for their assigned tournaments
        if (user?.role === 'tournament-admin' && user.assignedTournaments?.length) {
          if (!user.assignedTournaments.includes(matchData.tournamentId)) {
            router.push('/admin/tournaments');
            return;
          }
        }
        setMatch(matchData);
        // Always load tournament match format so tournament setting is honoured for scoring
        if (matchData.tournamentId) {
          try {
            const tourSnap = await getDoc(doc(db, 'tournaments', matchData.tournamentId));
            if (tourSnap.exists()) {
              const tourFormat = tourSnap.data().matchFormat as 'single-set' | 'best-of-3' | undefined;
              setTournamentMatchFormat(tourFormat === 'single-set' || tourFormat === 'best-of-3' ? tourFormat : 'best-of-3');
            }
          } catch {
            // keep default best-of-3
          }
        }

        // Initialize scores if match is live
        if (matchData.status === 'live') {
          setPlayer1Sets(matchData.sets?.filter(s => s.player1Score > s.player2Score).length || 0);
          setPlayer2Sets(matchData.sets?.filter(s => s.player2Score > s.player1Score).length || 0);
          setCurrentSet((matchData.sets?.length || 0) + 1);
        }
        // When completed: sync Live Score card from match result and pre-fill edit form
        if (matchData.status === 'completed') {
          setWinner(matchData.winner || '');
          setPlayer1Sets(matchData.player1Score ?? 0);
          setPlayer2Sets(matchData.player2Score ?? 0);
          const sets = matchData.sets || [];
          const lastSet = sets[sets.length - 1];
          setPlayer1Score(lastSet?.player1Score ?? 0);
          setPlayer2Score(lastSet?.player2Score ?? 0);
          setCurrentSet(sets.length || 1);
          setDirectSetsP1(String(matchData.player1Score ?? 0));
          setDirectSetsP2(String(matchData.player2Score ?? 0));
          setDirectSet1(sets[0] ? `${sets[0].player1Score}-${sets[0].player2Score}` : '');
          setDirectSet2(sets[1] ? `${sets[1].player1Score}-${sets[1].player2Score}` : '');
          setDirectSet3(sets[2] ? `${sets[2].player1Score}-${sets[2].player2Score}` : '');
        }
      } else {
        alert('Match not found');
        router.push('/admin/matches');
      }
    } catch (error) {
      console.error('Error loading match:', error);
      alert('Failed to load match details');
    } finally {
      setLoading(false);
    }
  };

  const setupLiveScoreListener = () => {
    const liveScoreRef = doc(db, 'liveScores', matchId);
    return onSnapshot(liveScoreRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setLiveScore({
          ...data,
          lastUpdated: data.lastUpdated?.toDate(),
        } as LiveScore);
      }
    });
  };

  const startMatch = async () => {
    try {
      setUpdating(true);
      await updateDoc(doc(db, 'matches', matchId), {
        status: 'live',
        actualStartTime: new Date(),
        updatedAt: new Date(),
      });
      
      // Create initial live score (doc id = matchId so updates and listeners work)
      await setDoc(doc(db, 'liveScores', matchId), {
        matchId,
        tournamentId: match!.tournamentId,
        currentSet: 1,
        player1Sets: 0,
        player2Sets: 0,
        player1CurrentScore: 0,
        player2CurrentScore: 0,
        player1Name: match!.player1Name,
        player2Name: match!.player2Name,
        isLive: true,
        lastUpdated: new Date(),
        updatedBy: user?.id,
      });
      
      loadMatch();
    } catch (error) {
      console.error('Error starting match:', error);
      alert('Failed to start match');
    } finally {
      setUpdating(false);
    }
  };

  const MAX_POINTS_PER_SET = 30; // Badminton/table tennis can go past 21 in deuce

  const updateScore = async (player: 'player1' | 'player2', increment: boolean = true) => {
    if (!match || match.status !== 'live') return;
    
    try {
      setUpdating(true);
      
      const newScore = increment ? 
        (player === 'player1' ? player1Score + 1 : player2Score + 1) :
        Math.max(0, player === 'player1' ? player1Score - 1 : player2Score - 1);
      
      if (player === 'player1') {
        setPlayer1Score(newScore);
      } else {
        setPlayer2Score(newScore);
      }

      // Update live score
      const liveScoreData = {
        matchId,
        tournamentId: match.tournamentId,
        currentSet,
        player1Sets,
        player2Sets,
        player1CurrentScore: player === 'player1' ? newScore : player1Score,
        player2CurrentScore: player === 'player2' ? newScore : player2Score,
        player1Name: match.player1Name,
        player2Name: match.player2Name,
        isLive: true,
        lastUpdated: new Date(),
        updatedBy: user?.id,
      };

      await updateDoc(doc(db, 'liveScores', matchId), liveScoreData);
    } catch (error) {
      console.error('Error updating score:', error);
      alert('Failed to update score');
    } finally {
      setUpdating(false);
    }
  };

  const setScoreTo = async (player: 'player1' | 'player2', value: number) => {
    if (!match || match.status !== 'live') return;
    const clamped = Math.max(0, Math.min(MAX_POINTS_PER_SET, value));
    try {
      setUpdating(true);
      const newP1 = player === 'player1' ? clamped : player1Score;
      const newP2 = player === 'player2' ? clamped : player2Score;
      setPlayer1Score(newP1);
      setPlayer2Score(newP2);
      const liveScoreData = {
        matchId,
        tournamentId: match.tournamentId,
        currentSet,
        player1Sets,
        player2Sets,
        player1CurrentScore: newP1,
        player2CurrentScore: newP2,
        player1Name: match.player1Name,
        player2Name: match.player2Name,
        isLive: true,
        lastUpdated: new Date(),
        updatedBy: user?.id,
      };
      await updateDoc(doc(db, 'liveScores', matchId), liveScoreData);
    } catch (error) {
      console.error('Error setting score:', error);
      alert('Failed to update score');
    } finally {
      setUpdating(false);
    }
  };

  const MIN_SET_SCORE = 21;
  const MIN_LEAD = 2;

  const canCloseSet = (p1: number, p2: number) =>
    (p1 >= MIN_SET_SCORE || p2 >= MIN_SET_SCORE) && Math.abs(p1 - p2) >= MIN_LEAD;

  const closeSet = async () => {
    if (!match || match.status !== 'live' || winner) return;
    const p1Score = player1Score;
    const p2Score = player2Score;
    if (!canCloseSet(p1Score, p2Score)) {
      alert(`Score must reach at least ${MIN_SET_SCORE} with a ${MIN_LEAD}-point lead (e.g. 21-19) to close the set.`);
      return;
    }
    const setsToWin = tournamentMatchFormat === 'single-set' ? 1 : 2;
    try {
      setUpdating(true);
      const newP1Sets = p1Score > p2Score ? player1Sets + 1 : player1Sets;
      const newP2Sets = p2Score > p1Score ? player2Sets + 1 : player2Sets;
      setPlayer1Sets(newP1Sets);
      setPlayer2Sets(newP2Sets);
      const newSet: MatchSet = {
        setNumber: currentSet,
        player1Score: p1Score,
        player2Score: p2Score,
      };
      const updatedSets = [...(match.sets || []), newSet];
      await updateDoc(doc(db, 'matches', matchId), {
        sets: updatedSets,
        updatedAt: new Date(),
      });
      if (newP1Sets >= setsToWin || newP2Sets >= setsToWin) {
        await completeMatch(p1Score > p2Score ? match.player1Name : match.player2Name, newP1Sets, newP2Sets);
      } else {
        setPlayer1Score(0);
        setPlayer2Score(0);
        setCurrentSet(currentSet + 1);
        await updateDoc(doc(db, 'liveScores', matchId), {
          matchId,
          tournamentId: match.tournamentId,
          currentSet: currentSet + 1,
          player1Sets: newP1Sets,
          player2Sets: newP2Sets,
          player1CurrentScore: 0,
          player2CurrentScore: 0,
          player1Name: match.player1Name,
          player2Name: match.player2Name,
          isLive: true,
          lastUpdated: new Date(),
          updatedBy: user?.id,
        });
      }
    } catch (error) {
      console.error('Error closing set:', error);
      alert('Failed to close set');
    } finally {
      setUpdating(false);
    }
  };

  const completeMatch = async (matchWinner: string, setsP1?: number, setsP2?: number) => {
    try {
      setWinner(matchWinner);
      const p1 = setsP1 ?? player1Sets;
      const p2 = setsP2 ?? player2Sets;
      await updateDoc(doc(db, 'matches', matchId), {
        status: 'completed',
        winner: matchWinner,
        player1Score: p1,
        player2Score: p2,
        actualEndTime: new Date(),
        updatedAt: new Date(),
      });
      
      // Update live score to not live
      await updateDoc(doc(db, 'liveScores', matchId), {
        isLive: false,
        lastUpdated: new Date(),
        updatedBy: user?.id,
      });
      
      alert(`Match completed! Winner: ${matchWinner}`);
    } catch (error) {
      console.error('Error completing match:', error);
      alert('Failed to complete match');
    }
  };

  const submitDirectScore = async () => {
    if (!match) return;
    // Honour tournament match format for scoring
    const setsToWin = tournamentMatchFormat === 'single-set' ? 1 : 2;
    const p1 = parseInt(directSetsP1, 10) || 0;
    const p2 = parseInt(directSetsP2, 10) || 0;
    if (p1 < 0 || p2 < 0 || p1 > 3 || p2 > 3) {
      alert('Sets won must be between 0 and 3 each.');
      return;
    }
    const total = p1 + p2;
    const maxSets = Math.max(p1, p2);
    if (setsToWin === 1) {
      if (total !== 1 || maxSets !== 1) {
        alert('Single set: enter 1-0 or 0-1.');
        return;
      }
    } else {
      if (total < 2 || total > 5 || maxSets < 2) {
        alert('Best of 3: one player must win 2 sets (e.g. 2-0 or 2-1).');
        return;
      }
    }
    const matchWinner = p1 > p2 ? match.player1Name : match.player2Name;
    const buildSetsFromInputs = (): MatchSet[] => {
      const parts = [directSet1, directSet2, directSet3].filter(Boolean);
      return parts.map((s, i) => {
        const [a, b] = s.split('-').map(n => parseInt(n.trim(), 10) || 0);
        return { setNumber: i + 1, player1Score: a, player2Score: b };
      });
    };
    const sets = buildSetsFromInputs();
    try {
      setUpdating(true);
      setWinner(matchWinner);
      const update: Record<string, unknown> = {
        status: 'completed',
        winner: matchWinner,
        player1Score: p1,
        player2Score: p2,
        actualEndTime: new Date(),
        updatedAt: new Date(),
      };
      if (sets.length > 0) update.sets = sets;
      if (!match.actualStartTime) update.actualStartTime = new Date();
      await updateDoc(doc(db, 'matches', matchId), update);
      try {
        await updateDoc(doc(db, 'liveScores', matchId), {
          isLive: false,
          lastUpdated: new Date(),
          updatedBy: user?.id,
        });
      } catch {
        // liveScores doc may not exist
      }
      alert(match.status === 'completed' ? `Score updated. Winner: ${matchWinner}` : `Result saved. Winner: ${matchWinner}`);
      loadMatch();
    } catch (error) {
      console.error('Error saving direct score:', error);
      alert('Failed to save result');
    } finally {
      setUpdating(false);
    }
  };

  const resetSet = () => {
    setPlayer1Score(0);
    setPlayer2Score(0);
  };

  const getScoreDisplay = (score: number) => {
    return score.toString().padStart(2, '0');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Match Not Found</h1>
          <Button onClick={() => router.push('/admin/matches')}>
            Back to Matches
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Match Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-6 w-6 text-blue-500" />
                  {match.round} - Match {match.matchNumber}
                </CardTitle>
                <CardDescription className="mt-2">
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(match.scheduledTime).toLocaleDateString()} at {new Date(match.scheduledTime).toLocaleTimeString()}
                    </span>
                    <span>{match.venue}</span>
                    {match.court && <span>Court: {match.court}</span>}
                    <Badge variant="secondary">
                      {tournamentMatchFormat === 'single-set' ? 'Single set' : 'Best of 3'}
                    </Badge>
                  </div>
                </CardDescription>
              </div>
              <Badge className={`${match.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                {match.status === 'live' ? (
                  <span className="flex items-center gap-1">
                    <Play className="h-4 w-4" />
                    LIVE
                  </span>
                ) : (
                  match.status
                )}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Live Score Display - single row */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Live Score</CardTitle>
            <CardDescription className="text-center">
              {match.status === 'live' ? 'Match in progress' : 'Match not started'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-2">
              {/* Player 1 name + score */}
              <div className="text-center min-w-0 flex-1">
                <h3 className="text-sm font-medium text-blue-600 truncate sm:text-base">{match.player1Name}</h3>
                <div className="text-4xl font-bold text-blue-600 sm:text-5xl mt-1">
                  {getScoreDisplay(player1Score)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Sets: {player1Sets}</div>
              </div>
              {/* Score separator */}
              <div className="flex flex-col items-center justify-center shrink-0 px-2">
                <span className="text-3xl font-bold text-gray-400 sm:text-4xl">–</span>
                {!winner && (
                  <span className="text-xs text-gray-500 mt-1">Set {currentSet}</span>
                )}
              </div>
              {/* Player 2 name + score */}
              <div className="text-center min-w-0 flex-1">
                <h3 className="text-sm font-medium text-red-600 truncate sm:text-base">{match.player2Name}</h3>
                <div className="text-4xl font-bold text-red-600 sm:text-5xl mt-1">
                  {getScoreDisplay(player2Score)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Sets: {player2Sets}</div>
              </div>
            </div>

            {winner && (
              <div className="text-center mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-yellow-800">Match Winner: {winner}</h3>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Controls */}
        {match.status === 'live' && !winner && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Score Controls</CardTitle>
              <CardDescription>Update the live score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                {/* Player 1 Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center text-blue-600">{match.player1Name}</h3>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => updateScore('player1', false)}
                      disabled={updating || player1Score === 0}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      -1
                    </Button>
                    <div className="flex-1 min-w-0">
                      <input
                        type="range"
                        min={0}
                        max={MAX_POINTS_PER_SET}
                        value={player1Score}
                        onChange={(e) => setScoreTo('player1', parseInt(e.target.value, 10))}
                        disabled={updating}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-blue-100 accent-blue-600 disabled:opacity-50"
                      />
                      <div className="text-xs text-center text-gray-500 mt-1">Drag: 0–{MAX_POINTS_PER_SET}</div>
                    </div>
                    <Button
                      onClick={() => updateScore('player1', true)}
                      disabled={updating}
                      className="shrink-0 bg-blue-600 hover:bg-blue-700"
                    >
                      +1
                    </Button>
                  </div>
                </div>

                {/* Player 2 Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center text-red-600">{match.player2Name}</h3>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => updateScore('player2', false)}
                      disabled={updating || player2Score === 0}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      -1
                    </Button>
                    <div className="flex-1 min-w-0">
                      <input
                        type="range"
                        min={0}
                        max={MAX_POINTS_PER_SET}
                        value={player2Score}
                        onChange={(e) => setScoreTo('player2', parseInt(e.target.value, 10))}
                        disabled={updating}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-red-100 accent-red-600 disabled:opacity-50"
                      />
                      <div className="text-xs text-center text-gray-500 mt-1">Drag: 0–{MAX_POINTS_PER_SET}</div>
                    </div>
                    <Button
                      onClick={() => updateScore('player2', true)}
                      disabled={updating}
                      className="shrink-0 bg-red-600 hover:bg-red-700"
                    >
                      +1
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <Button
                  onClick={closeSet}
                  disabled={updating || !canCloseSet(player1Score, player2Score)}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700"
                >
                  <Trophy className="h-4 w-4" />
                  Close set ({player1Score}-{player2Score})
                </Button>
                <Button
                  onClick={resetSet}
                  disabled={updating}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset Set
                </Button>
              </div>
              {!canCloseSet(player1Score, player2Score) && (player1Score >= 20 || player2Score >= 20) && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Reach {MIN_SET_SCORE}+ with a {MIN_LEAD}-point lead (e.g. 21-19) to enable Close set
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Set score directly - for scheduled or live matches */}
        {(match.status === 'scheduled' || (match.status === 'live' && !winner)) && (
          <Card className="mb-6 border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Set score directly
              </CardTitle>
              <CardDescription>
                {tournamentMatchFormat === 'single-set'
                  ? 'Single set: enter 1-0 or 0-1. Optionally add set score (e.g. 21-19).'
                  : 'Best of 3: enter sets won (e.g. 2-0 or 2-1). Optionally add set scores like 21-19, 18-21.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="directSetsP1">{match.player1Name} – Sets won</Label>
                    <Input
                      id="directSetsP1"
                      type="number"
                      min={0}
                      max={3}
                      value={directSetsP1}
                      onChange={(e) => setDirectSetsP1(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="directSetsP2">{match.player2Name} – Sets won</Label>
                    <Input
                      id="directSetsP2"
                      type="number"
                      min={0}
                      max={3}
                      value={directSetsP2}
                      onChange={(e) => setDirectSetsP2(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">
                    {tournamentMatchFormat === 'single-set' ? 'Optional set score (e.g. 21-19)' : 'Optional set scores (e.g. 21-19, 18-21, 21-15)'}
                  </Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Input
                      placeholder="Set 1: 21-19"
                      value={directSet1}
                      onChange={(e) => setDirectSet1(e.target.value)}
                      className="max-w-[120px]"
                    />
                    {tournamentMatchFormat === 'best-of-3' && (
                      <>
                        <Input
                          placeholder="Set 2: 18-21"
                          value={directSet2}
                          onChange={(e) => setDirectSet2(e.target.value)}
                          className="max-w-[120px]"
                        />
                        <Input
                          placeholder="Set 3: 21-15"
                          value={directSet3}
                          onChange={(e) => setDirectSet3(e.target.value)}
                          className="max-w-[120px]"
                        />
                      </>
                    )}
                  </div>
                </div>
                <Button
                  onClick={submitDirectScore}
                  disabled={updating}
                  className="w-full sm:w-auto"
                >
                  Save result
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit score - for completed matches */}
        {match.status === 'completed' && (
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Edit score
              </CardTitle>
              <CardDescription>
                Change the result below and click Update score. Same format rules apply (single set: 1-0 or 0-1; best of 3: 2-0 or 2-1).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editDirectSetsP1">{match.player1Name} – Sets won</Label>
                    <Input
                      id="editDirectSetsP1"
                      type="number"
                      min={0}
                      max={3}
                      value={directSetsP1}
                      onChange={(e) => setDirectSetsP1(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editDirectSetsP2">{match.player2Name} – Sets won</Label>
                    <Input
                      id="editDirectSetsP2"
                      type="number"
                      min={0}
                      max={3}
                      value={directSetsP2}
                      onChange={(e) => setDirectSetsP2(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">
                    {tournamentMatchFormat === 'single-set' ? 'Optional set score (e.g. 21-19)' : 'Optional set scores (e.g. 21-19, 18-21, 21-15)'}
                  </Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Input
                      placeholder="Set 1: 21-19"
                      value={directSet1}
                      onChange={(e) => setDirectSet1(e.target.value)}
                      className="max-w-[120px]"
                    />
                    {tournamentMatchFormat === 'best-of-3' && (
                      <>
                        <Input
                          placeholder="Set 2: 18-21"
                          value={directSet2}
                          onChange={(e) => setDirectSet2(e.target.value)}
                          className="max-w-[120px]"
                        />
                        <Input
                          placeholder="Set 3: 21-15"
                          value={directSet3}
                          onChange={(e) => setDirectSet3(e.target.value)}
                          className="max-w-[120px]"
                        />
                      </>
                    )}
                  </div>
                </div>
                <Button
                  onClick={submitDirectScore}
                  disabled={updating}
                  className="w-full sm:w-auto"
                >
                  Update score
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Match Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Match Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 justify-center">
              {match.status === 'scheduled' && (
                <Button
                  onClick={startMatch}
                  disabled={updating}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Play className="h-4 w-4" />
                  Start Match
                </Button>
              )}
              
              {match.status === 'live' && !winner && (
                <Button
                  onClick={() => {
                    const w = player1Sets > player2Sets ? match.player1Name : player2Sets > player1Sets ? match.player2Name : '';
                    if (w) completeMatch(w, player1Sets, player2Sets);
                    else alert('Use Set score directly to enter result, or complete the current set.');
                  }}
                  disabled={updating}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Pause className="h-4 w-4" />
                  End Match
                </Button>
              )}
              
              <Button
                onClick={() => router.push(`/admin/tournaments/${match.tournamentId}?tab=matches`)}
                variant="outline"
              >
                Back to Matches
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Previous Sets */}
        {match.sets && match.sets.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Previous Sets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {match.sets.map((set, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Set {set.setNumber}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-blue-600 font-semibold">{set.player1Score}</span>
                      <span className="text-gray-400">-</span>
                      <span className="text-red-600 font-semibold">{set.player2Score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
