'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { tournamentLiveScoreRef, tournamentMatchRef } from '@/lib/firestore-paths';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Match, Tournament, LiveScore } from '@/types';
import { Play, Clock, MapPin, Target, Trophy, Users, ArrowLeft, RefreshCw, Monitor } from 'lucide-react';
import Link from 'next/link';
import { getDisplaySides } from '@/lib/match-scoring';
import { scoreboardPath } from '@/lib/tournament-banner';

export default function LiveMatchPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId || !matchId) return;

    const loadTournament = async () => {
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
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
    };

    loadTournament();

    const matchUnsub = onSnapshot(tournamentMatchRef(tournamentId, matchId), (matchDoc) => {
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
      setLoading(false);
    });

    const liveUnsub = onSnapshot(tournamentLiveScoreRef(tournamentId, matchId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLiveScore({
          ...data,
          lastUpdated: data.lastUpdated?.toDate(),
          matchCompletedAt: data.matchCompletedAt?.toDate(),
        } as LiveScore);
      }
    });

    return () => {
      matchUnsub();
      liveUnsub();
    };
  }, [tournamentId, matchId]);

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case 'badminton': return '🏸';
      case 'table-tennis': return '🏓';
      case 'volleyball': return '🏐';
      default: return '🏆';
    }
  };

  const formatTime = (date: Date) => new Date(date).toLocaleTimeString();

  const getMatchDuration = () => {
    if (!match?.actualStartTime) return 'Not started';
    const diff = Date.now() - new Date(match.actualStartTime).getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const winner =
    liveScore?.winnerName ?? (match?.status === 'completed' ? match.winner : undefined);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!match || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Match Not Found</h1>
          <Link href={`/tournament/${tournamentId}`}>
            <Button>Back to Tournament</Button>
          </Link>
        </div>
      </div>
    );
  }

  const sides = liveScore
    ? getDisplaySides(
        { player1Name: liveScore.player1Name, player2Name: liveScore.player2Name },
        {
          p1: liveScore.player1CurrentScore,
          p2: liveScore.player2CurrentScore,
          sets1: liveScore.player1Sets,
          sets2: liveScore.player2Sets,
        },
        liveScore.sidesSwapped ?? false,
        liveScore.lastPointWonBy
      )
    : null;

  const showServing = !!liveScore?.isLive && !winner;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href={`/tournament/${tournamentId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="text-center min-w-0 flex-1">
            <p className="text-sm text-gray-500 truncate">{tournament.name}</p>
            <p className="font-semibold truncate">
              {match.round} · Match #{match.matchNumber}
            </p>
          </div>
          <Link href={scoreboardPath(matchId, tournamentId)} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-gray-900 hover:bg-gray-800">
              <Monitor className="h-4 w-4 mr-2" />
              Scoreboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="py-6 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {winner && (
            <div className="rounded-xl bg-yellow-50 border-2 border-yellow-300 p-6 text-center">
              <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
              <h2 className="text-2xl sm:text-3xl font-bold text-yellow-800">
                Congratulations, {winner}!
              </h2>
            </div>
          )}

          {liveScore && sides && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-500" />
                    Live Score
                  </CardTitle>
                  {liveScore.isLive && !winner && (
                    <Badge className="bg-emerald-100 text-emerald-800">
                      <Play className="h-3 w-3 mr-1" />
                      LIVE
                    </Badge>
                  )}
                </div>
                <CardDescription className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3" />
                  Updated {formatTime(liveScore.lastUpdated)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:gap-8">
                  <div className="text-center">
                    <div
                      className={`p-4 sm:p-6 rounded-lg ${
                        sides.left.color === 'blue' ? 'bg-blue-50' : 'bg-red-50'
                      }`}
                    >
                      <h3
                        className={`text-lg sm:text-xl font-semibold mb-2 truncate ${
                          sides.left.color === 'blue' ? 'text-blue-600' : 'text-red-600'
                        }`}
                      >
                        {sides.left.name}
                      </h3>
                      <div
                        className={`text-5xl sm:text-7xl font-bold tabular-nums ${
                          sides.left.color === 'blue' ? 'text-blue-600' : 'text-red-600'
                        }`}
                      >
                        {sides.left.score.toString().padStart(2, '0')}
                      </div>
                      <div className="h-6 mt-1 flex items-center justify-center" aria-hidden={!(showServing && sides.left.serving)}>
                        {showServing && sides.left.serving && (
                          <span className="text-xl leading-none" title="Serving">🏸</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Sets: {sides.left.sets}</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div
                      className={`p-4 sm:p-6 rounded-lg ${
                        sides.right.color === 'blue' ? 'bg-blue-50' : 'bg-red-50'
                      }`}
                    >
                      <h3
                        className={`text-lg sm:text-xl font-semibold mb-2 truncate ${
                          sides.right.color === 'blue' ? 'text-blue-600' : 'text-red-600'
                        }`}
                      >
                        {sides.right.name}
                      </h3>
                      <div
                        className={`text-5xl sm:text-7xl font-bold tabular-nums ${
                          sides.right.color === 'blue' ? 'text-blue-600' : 'text-red-600'
                        }`}
                      >
                        {sides.right.score.toString().padStart(2, '0')}
                      </div>
                      <div className="h-6 mt-1 flex items-center justify-center" aria-hidden={!(showServing && sides.right.serving)}>
                        {showServing && sides.right.serving && (
                          <span className="text-xl leading-none" title="Serving">🏸</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Sets: {sides.right.sets}</div>
                    </div>
                  </div>
                </div>
                {!winner && (
                  <div className="text-center mt-6">
                    <span className="inline-block bg-gray-100 px-4 py-2 rounded-lg text-lg font-semibold">
                      Set {liveScore.currentSet}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{getSportIcon(tournament.sport)}</span>
                {match.player1Name} vs {match.player2Name}
              </CardTitle>
              <CardDescription>
                <span className="flex flex-wrap items-center gap-3 text-sm">
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
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Status</div>
                  <Badge className={match.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {match.status}
                  </Badge>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Started</div>
                  <div className="text-sm font-medium">
                    {match.actualStartTime ? formatTime(match.actualStartTime) : '—'}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Duration</div>
                  <div className="text-sm font-medium font-mono">{getMatchDuration()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link href={scoreboardPath(matchId, tournamentId)} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="gap-2">
                <Monitor className="h-5 w-5" />
                Open projector scoreboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
