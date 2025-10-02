'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, addDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Match, LiveScore, MatchSet } from '@/types';
import { Play, Pause, Trophy, Clock, Target, RefreshCw } from 'lucide-react';

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

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin' && matchId) {
      loadMatch();
      setupLiveScoreListener();
    }
  }, [user, authLoading, router, matchId]);

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
        setMatch(matchData);
        
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
      
      // Create initial live score
      await addDoc(collection(db, 'liveScores'), {
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
    const maxScore = 21; // Standard badminton/table tennis score
    const minLead = 2;
    
    if ((p1Score >= maxScore || p2Score >= maxScore) && Math.abs(p1Score - p2Score) >= minLead) {
      // Set completed
      const setWinner = p1Score > p2Score ? match!.player1Name : match!.player2Name;
      
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
      
      // Reset scores for next set
      setPlayer1Score(0);
      setPlayer2Score(0);
      setCurrentSet(currentSet + 1);
      
      // Check for match completion
      const newP1Sets = p1Score > p2Score ? player1Sets + 1 : player1Sets;
      const newP2Sets = p2Score > p1Score ? player2Sets + 1 : player2Sets;
      
      if (newP1Sets >= 2 || newP2Sets >= 2) {
        completeMatch(p1Score > p2Score ? match!.player1Name : match!.player2Name);
      }
    }
  };

  const completeMatch = async (matchWinner: string) => {
    try {
      setWinner(matchWinner);
      
      await updateDoc(doc(db, 'matches', matchId), {
        status: 'completed',
        winner: matchWinner,
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
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(match.scheduledTime).toLocaleDateString()} at {new Date(match.scheduledTime).toLocaleTimeString()}
                    </span>
                    <span>{match.venue}</span>
                    {match.court && <span>Court: {match.court}</span>}
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
                  onClick={() => completeMatch('')}
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
