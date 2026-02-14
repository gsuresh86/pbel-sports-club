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
      
      // Check for set completion
      checkSetCompletion(player === 'player1' ? newScore : player1Score, player === 'player2' ? newScore : player2Score);
      
    } catch (error) {
      console.error('Error updating score:', error);
      alert('Failed to update score');
    } finally {
      setUpdating(false);
    }
  };

  const checkSetCompletion = (p1Score: number, p2Score: number) => {
    // Honour tournament match format for scoring
    const setsToWin = tournamentMatchFormat === 'single-set' ? 1 : 2;
    const maxScore = 21; // Standard badminton/table tennis score
    const minLead = 2;
    
    if ((p1Score >= maxScore || p2Score >= maxScore) && Math.abs(p1Score - p2Score) >= minLead) {
      // Set completed
      if (p1Score > p2Score) {
        setPlayer1Sets(player1Sets + 1);
      } else {
        setPlayer2Sets(player2Sets + 1);
      }
      
      // Add set to match
      const newSet: MatchSet = {
        setNumber: currentSet,
        player1Score: p1Score,
        player2Score: p2Score,
      };
      
      const updatedSets = [...(match!.sets || []), newSet];
      
      updateDoc(doc(db, 'matches', matchId), {
        sets: updatedSets,
        updatedAt: new Date(),
      });
      
      const newP1Sets = p1Score > p2Score ? player1Sets + 1 : player1Sets;
      const newP2Sets = p2Score > p1Score ? player2Sets + 1 : player2Sets;
      
      if (newP1Sets >= setsToWin || newP2Sets >= setsToWin) {
        completeMatch(p1Score > p2Score ? match!.player1Name : match!.player2Name, newP1Sets, newP2Sets);
      } else {
        // Reset scores for next set (best of 3 only)
        setPlayer1Score(0);
        setPlayer2Score(0);
        setCurrentSet(currentSet + 1);
      }
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
      alert(`Result saved. Winner: ${matchWinner}`);
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

        {/* Live Score Display */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Live Score</CardTitle>
            <CardDescription className="text-center">
              {match.status === 'live' ? 'Match in progress' : 'Match not started'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              {/* Player 1 */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-blue-600 mb-2">{match.player1Name}</h3>
                <div className="text-6xl font-bold text-blue-600 mb-4">
                  {getScoreDisplay(player1Score)}
                </div>
                <div className="text-sm text-gray-600">
                  Sets Won: {player1Sets}
                </div>
              </div>

              {/* VS */}
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-400 mb-2">VS</div>
                  <div className="text-sm text-gray-500">
                    Set {currentSet}
                  </div>
                </div>
              </div>

              {/* Player 2 */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-red-600 mb-2">{match.player2Name}</h3>
                <div className="text-6xl font-bold text-red-600 mb-4">
                  {getScoreDisplay(player2Score)}
                </div>
                <div className="text-sm text-gray-600">
                  Sets Won: {player2Sets}
                </div>
              </div>
            </div>

            {winner && (
              <div className="text-center mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
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
              <div className="grid grid-cols-2 gap-8">
                {/* Player 1 Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center text-blue-600">{match.player1Name}</h3>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => updateScore('player1', false)}
                      disabled={updating || player1Score === 0}
                      variant="outline"
                      size="sm"
                    >
                      -1
                    </Button>
                    <Button
                      onClick={() => updateScore('player1', true)}
                      disabled={updating}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      +1
                    </Button>
                  </div>
                </div>

                {/* Player 2 Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center text-red-600">{match.player2Name}</h3>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => updateScore('player2', false)}
                      disabled={updating || player2Score === 0}
                      variant="outline"
                      size="sm"
                    >
                      -1
                    </Button>
                    <Button
                      onClick={() => updateScore('player2', true)}
                      disabled={updating}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      +1
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mt-6">
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
            </CardContent>
          </Card>
        )}

        {/* Set score directly */}
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
                  <Label className="text-sm text-gray-600">Optional set scores (e.g. 21-19, 18-21, 21-15)</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Input
                      placeholder="Set 1: 21-19"
                      value={directSet1}
                      onChange={(e) => setDirectSet1(e.target.value)}
                      className="max-w-[120px]"
                    />
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
                onClick={() => router.push('/admin/matches')}
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
