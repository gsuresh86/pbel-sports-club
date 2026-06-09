'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ScoreboardDisplay } from '@/components/scoring/ScoreboardDisplay';
import { Match, Tournament, LiveScore } from '@/types';

export default function ScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;

    const loadMatch = async () => {
      try {
        const matchDoc = await getDoc(doc(db, 'matches', matchId));
        if (!matchDoc.exists()) {
          setLoading(false);
          return;
        }

        const matchData = matchDoc.data();
        const loadedMatch = {
          id: matchDoc.id,
          ...matchData,
          scheduledTime: matchData.scheduledTime?.toDate(),
          actualStartTime: matchData.actualStartTime?.toDate(),
          actualEndTime: matchData.actualEndTime?.toDate(),
          updatedAt: matchData.updatedAt?.toDate(),
        } as Match;
        setMatch(loadedMatch);

        if (loadedMatch.tournamentId) {
          const tournamentDoc = await getDoc(doc(db, 'tournaments', loadedMatch.tournamentId));
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
        }
      } catch (error) {
        console.error('Error loading scoreboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMatch();

    const unsubscribe = onSnapshot(doc(db, 'liveScores', matchId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLiveScore({
          ...data,
          lastUpdated: data.lastUpdated?.toDate(),
        } as LiveScore);
      } else {
        setLiveScore(null);
      }
    });

    return () => unsubscribe();
  }, [matchId]);

  useEffect(() => {
    if (match) {
      document.title = `${match.player1Name} vs ${match.player2Name} | Live Scoreboard`;
    }
  }, [match]);

  if (loading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-2xl">Match not found</p>
      </div>
    );
  }

  const isLive = liveScore?.isLive ?? match.status === 'live';
  const player1Score =
    liveScore?.player1CurrentScore ??
    match.sets?.[match.sets.length - 1]?.player1Score ??
    0;
  const player2Score =
    liveScore?.player2CurrentScore ??
    match.sets?.[match.sets.length - 1]?.player2Score ??
    0;
  const player1Sets = liveScore?.player1Sets ?? match.player1Score ?? 0;
  const player2Sets = liveScore?.player2Sets ?? match.player2Score ?? 0;
  const currentSet = liveScore?.currentSet ?? (match.sets?.length || 0) + 1;
  const winner = match.status === 'completed' ? match.winner : undefined;

  return (
    <ScoreboardDisplay
      tournamentName={tournament?.name ?? 'Tournament'}
      round={match.round}
      matchNumber={match.matchNumber}
      player1Name={liveScore?.player1Name ?? match.player1Name}
      player2Name={liveScore?.player2Name ?? match.player2Name}
      player1Score={isLive && liveScore ? liveScore.player1CurrentScore : player1Score}
      player2Score={isLive && liveScore ? liveScore.player2CurrentScore : player2Score}
      player1Sets={isLive && liveScore ? liveScore.player1Sets : player1Sets}
      player2Sets={isLive && liveScore ? liveScore.player2Sets : player2Sets}
      currentSet={currentSet}
      isLive={isLive && !winner}
      winner={winner}
      court={match.court}
    />
  );
}
