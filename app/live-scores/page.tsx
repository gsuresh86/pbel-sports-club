'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicLayout } from '@/components/PublicLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LiveScore, Match, Tournament } from '@/types';
import { Target, Clock, Trophy, Play, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function LiveScoresPage() {
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    setupLiveScoreListener();
  }, []);

  const loadData = async () => {
    try {
      // Load tournaments
      const tournamentsSnapshot = await getDocs(collection(db, 'tournaments'));
      const tournamentsData = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        registrationDeadline: doc.data().registrationDeadline?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Tournament[];
      setTournaments(tournamentsData);

      // Load matches
      const matchesSnapshot = await getDocs(collection(db, 'matches'));
      const matchesData = matchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledTime: doc.data().scheduledTime?.toDate(),
        actualStartTime: doc.data().actualStartTime?.toDate(),
        actualEndTime: doc.data().actualEndTime?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Match[];
      setMatches(matchesData);

      // Load live scores
      const liveScoresSnapshot = await getDocs(collection(db, 'liveScores'));
      const liveScoresData = liveScoresSnapshot.docs.map(doc => ({
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated?.toDate(),
      })) as LiveScore[];
      setLiveScores(liveScoresData.filter(score => score.isLive));
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
      setLiveScores(liveScoresData.filter(score => score.isLive));
    });
  };

  const getTournamentName = (tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    return tournament?.name || 'Unknown Tournament';
  };

  const getMatchDetails = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    return match;
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  const getScoreDisplay = (score: number) => {
    return score.toString().padStart(2, '0');
  };

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case 'badminton': return '🏸';
      case 'table-tennis': return '🏓';
      case 'volleyball': return '🏐';
      default: return '🏆';
    }
  };

  const getSportBanner = (sport: string) => {
    switch (sport) {
      case 'badminton':
        return 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200&q=80';
      case 'table-tennis':
        return 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200&q=80';
      case 'volleyball':
        return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200&q=80';
      default:
        return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200&q=80';
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">Loading live scores...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="backdrop-blur-sm py-8 px-4">
        <div className="max-w-7xl mx-auto bg-white/90">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-3">
            <Target className="h-10 w-10 text-red-500" />
            Live Scores
          </h1>
          <p className="text-xl text-gray-600">Real-time updates from ongoing matches</p>
        </div>

        {/* Live Indicator */}
        {liveScores.length > 0 && (
          <div className="mb-6 text-center">
            <Badge className="bg-red-100 text-red-800 animate-pulse">
              <Play className="h-4 w-4 mr-1" />
              LIVE NOW - {liveScores.length} match{liveScores.length !== 1 ? 'es' : ''} in progress
            </Badge>
          </div>
        )}

        {/* Live Scores Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveScores.map((liveScore) => {
            const match = getMatchDetails(liveScore.matchId);
            const tournament = tournaments.find(t => t.id === liveScore.tournamentId);
            
            return (
              <Card key={liveScore.matchId} className="hover:shadow-lg transition-shadow border-l-4 border-l-red-500 overflow-hidden">
                {/* Sport Banner */}
                <div className="relative h-24 w-full overflow-hidden">
                  <img
                    src={getSportBanner(tournament?.sport || 'badminton')}
                    alt={`${tournament?.sport} tournament`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <span className="text-2xl">{getSportIcon(tournament?.sport || 'badminton')}</span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-red-100 text-red-800 animate-pulse">
                      <Play className="h-3 w-3 mr-1" />
                      LIVE
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="pb-3">
                  <div>
                    <CardTitle className="text-lg">{getTournamentName(liveScore.tournamentId)}</CardTitle>
                    <CardDescription className="mt-1">
                      {match?.round} - Match {match?.matchNumber}
                    </CardDescription>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Players */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center bg-blue-50 p-3 rounded-lg">
                        <h3 className="font-semibold text-blue-600 text-sm">{liveScore.player1Name}</h3>
                        <div className="text-2xl font-bold text-blue-600 mt-1">
                          {getScoreDisplay(liveScore.player1CurrentScore)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Sets: {liveScore.player1Sets}
                        </div>
                      </div>
                      <div className="text-center bg-red-50 p-3 rounded-lg">
                        <h3 className="font-semibold text-red-600 text-sm">{liveScore.player2Name}</h3>
                        <div className="text-2xl font-bold text-red-600 mt-1">
                          {getScoreDisplay(liveScore.player2CurrentScore)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Sets: {liveScore.player2Sets}
                        </div>
                      </div>
                    </div>

                    {/* Set Info */}
                    <div className="text-center">
                      <div className="bg-gray-100 p-2 rounded-lg">
                        <p className="text-sm font-medium">Set {liveScore.currentSet}</p>
                        <p className="text-xs text-gray-600">
                          Last updated: {formatTime(liveScore.lastUpdated)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link href={`/tournament/${liveScore.tournamentId}/live/${liveScore.matchId}`} className="flex-1">
                        <Button className="w-full" size="sm">
                          <Target className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </Link>
                      <Link href={`/tournament/${liveScore.tournamentId}`} className="flex-1">
                        <Button variant="outline" className="w-full" size="sm">
                          Tournament
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* No Live Matches */}
        {liveScores.length === 0 && (
          <div className="text-center py-12">
            <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Live Matches</h3>
            <p className="text-gray-600 mb-6">There are currently no matches being played live</p>
            <div className="flex gap-4 justify-center">
              <Link href="/tournament">
                <Button variant="outline">
                  View Tournaments
                </Button>
              </Link>
              <Link href="/schedules">
                <Button variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  View Schedules
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Recent Completed Matches */}
        {liveScores.length === 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Recent Completed Matches
              </CardTitle>
              <CardDescription>Latest match results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {matches
                  .filter(match => match.status === 'completed')
                  .slice(0, 5)
                  .map((match) => {
                    const tournament = tournaments.find(t => t.id === match.tournamentId);
                    return (
                      <div key={match.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{match.player1Name} vs {match.player2Name}</p>
                          <p className="text-sm text-gray-600">{tournament?.name} - {match.round}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">Winner: {match.winner}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(match.actualEndTime || match.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                {matches.filter(match => match.status === 'completed').length === 0 && (
                  <p className="text-gray-500 text-center py-4">No completed matches yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto-refresh indicator */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Auto-refreshing every 30 seconds
          </div>
        </div>
        </div>
      </div>
    </PublicLayout>
  );
}