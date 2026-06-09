'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { collection, doc, getDoc, getDocFromServer, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ScoreboardDisplay } from '@/components/scoring/ScoreboardDisplay';
import { resolveTournamentBannerUrl } from '@/lib/tournament-banner';
import { fetchTournamentRegistrations, toTournament } from '@/lib/tournament-api';
import { getMatchLiveDisplayNames } from '@/lib/utils';
import { Match, Tournament, LiveScore, Registration } from '@/types';

function ScoreboardLoading() {
  return (
    <div className="h-dvh w-full flex items-center justify-center bg-zinc-950">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white" />
    </div>
  );
}

function ScoreboardPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const queryTournamentId =
    searchParams.get('tournamentId')?.trim() ||
    searchParams.get('tournament')?.trim() ||
    null;

  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [liveScoreReady, setLiveScoreReady] = useState(false);
  const [tournamentLoading, setTournamentLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  const effectiveTournamentId = useMemo(
    () =>
      queryTournamentId ||
      match?.tournamentId?.trim() ||
      liveScore?.tournamentId?.trim() ||
      null,
    [queryTournamentId, match?.tournamentId, liveScore?.tournamentId]
  );

  useEffect(() => {
    if (!matchId) return;

    const matchUnsub = onSnapshot(doc(db, 'matches', matchId), (matchDoc) => {
      if (!matchDoc.exists()) {
        setMatch(null);
        setMatchLoading(false);
        return;
      }
      const matchData = matchDoc.data();
      setMatch({
        id: matchDoc.id,
        ...matchData,
        scheduledTime: matchData.scheduledTime?.toDate(),
        actualStartTime: matchData.actualStartTime?.toDate(),
        actualEndTime: matchData.actualEndTime?.toDate(),
        updatedAt: matchData.updatedAt?.toDate(),
      } as Match);
      setMatchLoading(false);
    });

    const liveUnsub = onSnapshot(doc(db, 'liveScores', matchId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLiveScore({
          ...data,
          lastUpdated: data.lastUpdated?.toDate(),
          matchCompletedAt: data.matchCompletedAt?.toDate(),
        } as LiveScore);
      } else {
        setLiveScore(null);
      }
      setLiveScoreReady(true);
    });

    return () => {
      matchUnsub();
      liveUnsub();
    };
  }, [matchId]);

  useEffect(() => {
    if (!effectiveTournamentId) {
      setTournament(null);
      setTournamentLoading(false);
      return;
    }

    let cancelled = false;
    setTournamentLoading(true);

    const applyTournament = (data: Record<string, unknown>, id: string) => {
      if (!cancelled) {
        setTournament(toTournament(data, id));
        setTournamentLoading(false);
      }
    };

    const tournamentRef = doc(db, 'tournaments', effectiveTournamentId);

    (async () => {
      try {
        const serverSnap = await getDocFromServer(tournamentRef);
        if (serverSnap.exists()) {
          applyTournament(serverSnap.data(), serverSnap.id);
        } else if (!cancelled) {
          setTournament(null);
          setTournamentLoading(false);
        }
      } catch {
        const cacheSnap = await getDoc(tournamentRef);
        if (cacheSnap.exists()) {
          applyTournament(cacheSnap.data(), cacheSnap.id);
        } else if (!cancelled) {
          setTournament(null);
          setTournamentLoading(false);
        }
      }
    })();

    const tournamentUnsub = onSnapshot(tournamentRef, (tournamentDoc) => {
      if (tournamentDoc.exists()) {
        applyTournament(tournamentDoc.data(), tournamentDoc.id);
      } else if (!cancelled) {
        setTournament(null);
        setTournamentLoading(false);
      }
    });

    return () => {
      cancelled = true;
      tournamentUnsub();
    };
  }, [effectiveTournamentId]);

  useEffect(() => {
    if (!effectiveTournamentId) {
      setRegistrations([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const regs = await fetchTournamentRegistrations(effectiveTournamentId);
        if (cancelled) return;
        setRegistrations(regs);
      } catch {
        if (!cancelled) setRegistrations([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveTournamentId]);

  useEffect(() => {
    if (match) {
      const regById = new Map(registrations.map(r => [r.id, r]));
      const names = getMatchLiveDisplayNames(match, regById);
      document.title = `${names.player1Name} vs ${names.player2Name} | Live Scoreboard`;
    }
  }, [match, registrations]);

  const regById = useMemo(() => new Map(registrations.map(r => [r.id, r])), [registrations]);
  const matchDisplayNames = match ? getMatchLiveDisplayNames(match, regById) : null;

  const waitingForTournamentId =
    !matchLoading && match !== null && !effectiveTournamentId && !liveScoreReady;
  const waitingForTournamentDoc = !!effectiveTournamentId && tournamentLoading;
  const loading = matchLoading || waitingForTournamentId || waitingForTournamentDoc;

  if (loading) {
    return <ScoreboardLoading />;
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
  const winner =
    liveScore?.winnerName ??
    (match.status === 'completed' ? match.winner : undefined);

  const bannerUrl = resolveTournamentBannerUrl(tournament);
  const player1DisplayName = matchDisplayNames?.player1Name ?? match.player1Name;
  const player2DisplayName = matchDisplayNames?.player2Name ?? match.player2Name;

  return (
    <ScoreboardDisplay
      tournamentName={tournament?.name ?? 'Tournament'}
      bannerUrl={bannerUrl}
      round={match.round}
      matchNumber={match.matchNumber}
      player1Name={player1DisplayName}
      player2Name={player2DisplayName}
      player1Score={isLive && liveScore ? liveScore.player1CurrentScore : player1Score}
      player2Score={isLive && liveScore ? liveScore.player2CurrentScore : player2Score}
      player1Sets={isLive && liveScore ? liveScore.player1Sets : player1Sets}
      player2Sets={isLive && liveScore ? liveScore.player2Sets : player2Sets}
      currentSet={currentSet}
      isLive={isLive && !winner}
      winner={winner}
      court={match.court}
      sidesSwapped={liveScore?.sidesSwapped ?? false}
    />
  );
}

export default function ScoreboardPage() {
  return (
    <Suspense fallback={<ScoreboardLoading />}>
      <ScoreboardPageInner />
    </Suspense>
  );
}
