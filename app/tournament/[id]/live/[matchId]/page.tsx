'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Match, Tournament, LiveScore } from '@/types';
import { Play, Clock, MapPin, Target, Trophy, Users, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function LiveMatchPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const matchId = params.matchId as string;
  
  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (tournamentId && matchId) {
      loadData();
      setupLiveScoreListener();
    }
  }, [tournamentId, matchId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 1000); // Update every second for real-time feel
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [matchDoc, tournamentDoc] = await Promise.all([
        getDoc(doc(db, 'matches', matchId)),
        getDoc(doc(db, 'tournaments', tournamentId)),
      ]);

      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        setMatch({
          id: matchDoc.id,
          ...matchData,
          scheduledTime: matchData.scheduledTime?.toDate(),
          actualStartTime: matchData.actualStartTime?.toDate(),
          actualEndTime: matchData.actualEndTime?.toDate(),
          updatedAt: matchData.updatedAt?.toDate(),
        } as Match);
      }

      if (tournamentDoc.exists()) {
        const tournamentData = tournamentDoc.data();
        setTournament({
          id: tournamentDoc.id,
          ...tournamentData,
          startDate: tournamentData.startDate?.toDate(),
          endDate: tournamentData.endDate?.toDate(),
          registrationDeadline: tournamentData.registrationDeadline?.toDate(),
          createdAt: tournamentData.createdAt?.toDate(),
          updatedAt: tournamentData.updatedAt?.toDate(),
        } as Tournament);
      }
    } catch (error) {
      console.error('Error loading data:', error);
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
          id: doc.id,
          ...data,
          lastUpdated: data.lastUpdated?.toDate(),
        } as LiveScore);
      }
    });
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
        return 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'table-tennis':
        return 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'volleyball':
        return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      default:
        return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
    }
  };

  const getScoreDisplay = (score: number) => {
    return score.toString().padStart(2, '0');
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  const getMatchDuration = () => {
    if (!match?.actualStartTime) return 'Not started';
    const start = new Date(match.actualStartTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!match || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Match Not Found</h1>
          <Link href="/live-scores">
            <Button>Back to Live Scores</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sport Banner */}
      <div className="relative h-64 w-full overflow-hidden">
        <img
          src={getSportBanner(tournament.sport)}
          alt={`${tournament.sport} tournament`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-2">{tournament.name}</h1>
            <p className="text-xl">{match.round} - Match #{match.matchNumber}</p>
          </div>
        </div>
        <div className="absolute top-4 left-4">
          <Link href={`/tournament/${tournamentId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tournament
            </Button>
          </Link>
        </div>
        <div className="absolute top-4 right-4">
          <Badge className="bg-red-100 text-red-800 animate-pulse">
            <Play className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Match Info */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{getSportIcon(tournament.sport)}</span>
                    {match.player1} vs {match.player2}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {match.venue}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {match.scheduledTime?.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {match.round}
                      </span>
                    </div>
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 mb-1">Match Duration</div>
                  <div className="text-lg font-mono">{getMatchDuration()}</div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Live Score Display */}
          {liveScore && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-red-500" />
                    Live Score
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Last updated: {formatTime(liveScore.lastUpdated)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Player 1 */}
                  <div className="text-center">
                    <div className="bg-blue-50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-blue-600 mb-2">{liveScore.player1Name}</h3>
                      <div className="text-6xl font-bold text-blue-600 mb-2">
                        {getScoreDisplay(liveScore.player1CurrentScore)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Sets Won: {liveScore.player1Sets}
                      </div>
                    </div>
                  </div>

                  {/* Player 2 */}
                  <div className="text-center">
                    <div className="bg-red-50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-red-600 mb-2">{liveScore.player2Name}</h3>
                      <div className="text-6xl font-bold text-red-600 mb-2">
                        {getScoreDisplay(liveScore.player2CurrentScore)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Sets Won: {liveScore.player2Sets}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Set Info */}
                <div className="text-center mt-6">
                  <div className="bg-gray-100 p-4 rounded-lg inline-block">
                    <div className="text-2xl font-bold text-gray-800">Set {liveScore.currentSet}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {liveScore.isLive ? 'Match in Progress' : 'Match Paused'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Match Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Status</div>
                  <Badge className={match.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {match.status}
                  </Badge>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Started</div>
                  <div className="font-medium">
                    {match.actualStartTime ? formatTime(match.actualStartTime) : 'Not started'}
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Duration</div>
                  <div className="font-medium">{getMatchDuration()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tournament Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Tournament Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Tournament Details</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Name:</strong> {tournament.name}</p>
                    <p><strong>Sport:</strong> {tournament.sport}</p>
                    <p><strong>Venue:</strong> {tournament.venue}</p>
                    <p><strong>Dates:</strong> {tournament.startDate.toLocaleDateString()} - {tournament.endDate.toLocaleDateString()}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Match Details</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Round:</strong> {match.round}</p>
                    <p><strong>Match Number:</strong> #{match.matchNumber}</p>
                    <p><strong>Venue:</strong> {match.venue}</p>
                    <p><strong>Scheduled:</strong> {match.scheduledTime?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto-refresh indicator */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Auto-refreshing every second
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
