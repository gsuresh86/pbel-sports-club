'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, query, where, doc, setDoc, updateDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Match, Tournament, LiveScore } from '@/types';
import { Play, Pause, Square, Plus, Clock, Target, Trophy, Users, RefreshCw } from 'lucide-react';

export default function UpdateLiveScoresPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, {
    currentSet: number;
    player1Sets: number;
    player2Sets: number;
    player1CurrentScore: number;
    player2CurrentScore: number;
    isLive: boolean;
  }>>({});
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      loadData();
      setupLiveScoreListener();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLastUpdate(new Date());
      }, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadData = async () => {
    try {
      const [allMatchesSnapshot, liveMatchesSnapshot, tournamentsSnapshot] = await Promise.all([
        getDocs(collection(db, 'matches')),
        getDocs(query(collection(db, 'matches'), where('status', '==', 'live'))),
        getDocs(collection(db, 'tournaments')),
      ]);

      const allMatchesData = allMatchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledTime: doc.data().scheduledTime?.toDate(),
        actualStartTime: doc.data().actualStartTime?.toDate(),
        actualEndTime: doc.data().actualEndTime?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Match[];

      const liveMatchesData = liveMatchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledTime: doc.data().scheduledTime?.toDate(),
        actualStartTime: doc.data().actualStartTime?.toDate(),
        actualEndTime: doc.data().actualEndTime?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Match[];

      const tournamentsData = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];

      setAllMatches(allMatchesData);
      setLiveMatches(liveMatchesData);
      setTournaments(tournamentsData);

      // Load existing live scores
      const liveScoresSnapshot = await getDocs(collection(db, 'liveScores'));
      const existingScores: Record<string, {
        currentSet: number;
        player1Sets: number;
        player2Sets: number;
        player1CurrentScore: number;
        player2CurrentScore: number;
        isLive: boolean;
      }> = {};
      liveScoresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        existingScores[data.matchId] = {
          currentSet: data.currentSet || 1,
          player1Sets: data.player1Sets || 0,
          player2Sets: data.player2Sets || 0,
          player1CurrentScore: data.player1CurrentScore || 0,
          player2CurrentScore: data.player2CurrentScore || 0,
          isLive: data.isLive || false,
        };
      });

      // Initialize scores state for new live matches
      const initialScores: Record<string, {
        currentSet: number;
        player1Sets: number;
        player2Sets: number;
        player1CurrentScore: number;
        player2CurrentScore: number;
        isLive: boolean;
      }> = { ...existingScores };
      liveMatchesData.forEach(match => {
        if (!initialScores[match.id]) {
          initialScores[match.id] = {
            currentSet: 1,
            player1Sets: 0,
            player2Sets: 0,
            player1CurrentScore: 0,
            player2CurrentScore: 0,
            isLive: true,
          };
        }
      });
      setScores(initialScores);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupLiveScoreListener = () => {
    const liveScoresRef = collection(db, 'liveScores');
    return onSnapshot(liveScoresRef, (snapshot) => {
      const liveScoresData = snapshot.docs.map(doc => ({
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated?.toDate(),
      })) as LiveScore[];
      
      // Update scores state with real-time data
      const updatedScores: Record<string, {
        currentSet: number;
        player1Sets: number;
        player2Sets: number;
        player1CurrentScore: number;
        player2CurrentScore: number;
        isLive: boolean;
      }> = {};
      liveScoresData.forEach(score => {
        updatedScores[score.matchId] = {
          currentSet: score.currentSet || 1,
          player1Sets: score.player1Sets || 0,
          player2Sets: score.player2Sets || 0,
          player1CurrentScore: score.player1CurrentScore || 0,
          player2CurrentScore: score.player2CurrentScore || 0,
          isLive: score.isLive || false,
        };
      });
      setScores(prev => ({ ...prev, ...updatedScores }));
    });
  };

  const handleScoreUpdate = async (matchId: string) => {
    try {
      const match = allMatches.find(m => m.id === matchId);
      const scoreData = {
        ...scores[matchId],
        matchId,
        tournamentId: match?.tournamentId,
        player1Name: match?.player1Name,
        player2Name: match?.player2Name,
        isLive: true,
        lastUpdated: new Date(),
      };

      await setDoc(doc(db, 'liveScores', matchId), scoreData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error updating score:', error);
      alert('Failed to update score');
    }
  };

  const handleStartMatch = async (matchId: string) => {
    try {
      const match = allMatches.find(m => m.id === matchId);
      if (!match) return;

      // Update match status to live
      await updateDoc(doc(db, 'matches', matchId), {
        status: 'live',
        actualStartTime: new Date(),
        updatedAt: new Date(),
      });

      // Initialize live score
      const scoreData = {
        matchId,
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
      };

      await setDoc(doc(db, 'liveScores', matchId), scoreData);
      loadData();
    } catch (error) {
      console.error('Error starting match:', error);
      alert('Failed to start match');
    }
  };

  const handlePauseMatch = async (matchId: string) => {
    try {
      await updateDoc(doc(db, 'liveScores', matchId), {
        isLive: false,
        lastUpdated: new Date(),
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error pausing match:', error);
      alert('Failed to pause match');
    }
  };

  const handleResumeMatch = async (matchId: string) => {
    try {
      await updateDoc(doc(db, 'liveScores', matchId), {
        isLive: true,
        lastUpdated: new Date(),
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error resuming match:', error);
      alert('Failed to resume match');
    }
  };

  const handleMatchComplete = async (matchId: string) => {
    if (confirm('Mark this match as completed?')) {
      try {
        const score = scores[matchId];
        const match = allMatches.find(m => m.id === matchId);

        // Update match status
        await updateDoc(doc(db, 'matches', matchId), {
          status: 'completed',
          player1Score: score.player1Sets,
          player2Score: score.player2Sets,
          winner: score.player1Sets > score.player2Sets ? match?.player1Name : match?.player2Name,
          actualEndTime: new Date(),
          updatedAt: new Date(),
        });

        // Remove from live scores
        await updateDoc(doc(db, 'liveScores', matchId), {
          isLive: false,
          lastUpdated: new Date(),
        });

        loadData();
      } catch (error) {
        console.error('Error completing match:', error);
        alert('Failed to complete match');
      }
    }
  };

  const getFilteredMatches = () => {
    if (selectedTournament === 'all') {
      return allMatches;
    }
    return allMatches.filter(match => match.tournamentId === selectedTournament);
  };

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'live': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'postponed': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTournament = (tournamentId: string) => {
    return tournaments.find(t => t.id === tournamentId);
  };

  if (authLoading || loading || !user || user.role !== 'admin') {
    return null;
  }

  return (
    <AdminLayout moduleName="Live Scores">
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Target className="h-8 w-8 text-red-500" />
              Live Score Management
            </h1>
            <p className="text-gray-600">Manage live matches and real-time scoring</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
            </Button>
          </div>
        </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <Label htmlFor="tournament-filter">Filter by Tournament</Label>
                  <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tournament" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tournaments</SelectItem>
                      {tournaments.map(tournament => (
                        <SelectItem key={tournament.id} value={tournament.id}>
                          {tournament.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-gray-500">
                  {getFilteredMatches().length} matches found
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Matches */}
          {liveMatches.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Play className="h-6 w-6 text-red-500" />
                Live Matches ({liveMatches.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {liveMatches.map((match) => {
                  const tournament = getTournament(match.tournamentId);
                  const score = scores[match.id] || {};

                  return (
                    <Card key={match.id} className="border-l-4 border-l-red-500">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {tournament?.name} - {match.round}
                            </CardTitle>
                            <p className="text-sm text-gray-500">Match #{match.matchNumber} • {match.venue}</p>
                          </div>
                          <Badge className="bg-red-100 text-red-800 animate-pulse">
                            <Play className="h-3 w-3 mr-1" />
                            LIVE
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Score Display */}
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-blue-600">{match.player1Name}</h3>
                            <div className="text-2xl font-bold text-blue-600 mt-2">
                              {score.player1CurrentScore || 0}
                            </div>
                            <div className="text-sm text-gray-600">Sets: {score.player1Sets || 0}</div>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-red-600">{match.player2Name}</h3>
                            <div className="text-2xl font-bold text-red-600 mt-2">
                              {score.player2CurrentScore || 0}
                            </div>
                            <div className="text-sm text-gray-600">Sets: {score.player2Sets || 0}</div>
                          </div>
                        </div>

                        {/* Score Controls */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <h4 className="font-medium text-blue-600">{match.player1Name}</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Sets</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={score.player1Sets || 0}
                                  onChange={(e) => setScores({
                                    ...scores,
                                    [match.id]: {
                                      ...score,
                                      player1Sets: parseInt(e.target.value) || 0,
                                    },
                                  })}
                                  className="text-center"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Current</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={score.player1CurrentScore || 0}
                                  onChange={(e) => setScores({
                                    ...scores,
                                    [match.id]: {
                                      ...score,
                                      player1CurrentScore: parseInt(e.target.value) || 0,
                                    },
                                  })}
                                  className="text-center"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-medium text-red-600">{match.player2Name}</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Sets</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={score.player2Sets || 0}
                                  onChange={(e) => setScores({
                                    ...scores,
                                    [match.id]: {
                                      ...score,
                                      player2Sets: parseInt(e.target.value) || 0,
                                    },
                                  })}
                                  className="text-center"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Current</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={score.player2CurrentScore || 0}
                                  onChange={(e) => setScores({
                                    ...scores,
                                    [match.id]: {
                                      ...score,
                                      player2CurrentScore: parseInt(e.target.value) || 0,
                                    },
                                  })}
                                  className="text-center"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={score.currentSet || 1}
                            onChange={(e) => setScores({
                              ...scores,
                              [match.id]: {
                                ...score,
                                currentSet: parseInt(e.target.value) || 1,
                              },
                            })}
                            className="w-20 text-center"
                          />
                          <Label className="flex items-center">Set</Label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleScoreUpdate(match.id)} 
                            className="flex-1"
                            size="sm"
                          >
                            Update Score
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handlePauseMatch(match.id)}
                            size="sm"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleMatchComplete(match.id)}
                            size="sm"
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Matches */}
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-6 w-6" />
              All Matches
            </h2>
            <div className="space-y-4">
              {getFilteredMatches().map((match) => {
                const tournament = getTournament(match.tournamentId);
                const isLive = match.status === 'live';
                const hasLiveScore = scores[match.id]?.isLive;

                return (
                  <Card key={match.id} className={isLive ? 'border-l-4 border-l-green-500' : ''}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">
                              {tournament?.name} - {match.round} (Match #{match.matchNumber})
                            </h3>
                            <Badge className={getMatchStatusColor(match.status)}>
                              {match.status}
                            </Badge>
                            {isLive && (
                              <Badge className="bg-red-100 text-red-800 animate-pulse">
                                <Play className="h-3 w-3 mr-1" />
                                LIVE
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {match.player1Name} vs {match.player2Name} • {match.venue}
                          </p>
                          {match.scheduledTime && (
                            <p className="text-xs text-gray-500">
                              Scheduled: {match.scheduledTime.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {match.status === 'scheduled' && (
                            <Button
                              size="sm"
                              onClick={() => handleStartMatch(match.id)}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Start Match
                            </Button>
                          )}
                          {isLive && !hasLiveScore && (
                            <Button
                              size="sm"
                              onClick={() => handleResumeMatch(match.id)}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Resume
                            </Button>
                          )}
                          {isLive && hasLiveScore && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePauseMatch(match.id)}
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* No Matches */}
          {getFilteredMatches().length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Matches Found</h3>
                <p className="text-gray-600">
                  {selectedTournament === 'all' 
                    ? 'No matches have been created yet.' 
                    : 'No matches found for the selected tournament.'}
                </p>
              </CardContent>
            </Card>
          )}
      </div>
    </AdminLayout>
  );
}
